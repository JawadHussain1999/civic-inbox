# SolarX Civic Inbox — Engineering Audit & Architecture Document

Civic Inbox is a web application that helps a city receive, organize, assign, and resolve citizen-reported complaints. The application supports three primary roles: **Citizen**, **Admin**, and **Staff**.

This document outlines the system architecture, design decisions, safety measures, concurrency controls, and known engineering trade-offs.

---

## 🏗️ 1. Architecture Flow

The system is built as a decoupled Client-Server architecture:

```text
React (Vite + TypeScript)
        ↓  [HTTPS + JWT Auth Header]
Express API Server (TypeScript)
        ↓
    Services (AI, Lexical Normalizers, Geo Calculations)
        ↓
   MongoDB (Mongoose Schema & Indices)
```

- **Frontend**: A single-page React app styled with **Tailwind CSS v4** for a clean, professional light theme.
- **Backend**: Express server running on Node.js using TypeScript for type-safety.
- **Database**: MongoDB (via Mongoose), utilizing indexes on critical query paths (like citizen ownership and department statuses).

---

## 🔑 2. Main Entities & Schema Model

- **User**: Represents authenticated accounts with roles (`citizen`, `admin`, `staff`). Staff accounts store an associated `department`.
- **Complaint**: The raw citizen report. Contains text description, optional base64 photo attachment, latitude/longitude, and the raw `aiSuggestion`. Points to a parent `Job` once grouped.
- **Job**: The dispatched work order. It groups multiple related `complaints` together. It stores `aiSuggestion` snapshots, `humanCorrection` overrides, and the current active (`department`, `urgency`, `summary`) fields.

---

## 🛰️ 3. Complaint Grouping Strategy

The system groups incoming complaints that represent the **same physical problem** in **approximately the same location**. We avoid grouping based on distance alone to prevent merging unrelated nearby issues (e.g., a pothole next to a broken streetlight).

### Hybrid Scoring Algorithm
When a new complaint is received, we query active, uncompleted jobs within a configurable geographic radius (`GROUPING_DISTANCE_METERS`, default `200m`). For each candidate job, we compute a **Hybrid Group Score**:

$$\text{groupScore} = (\text{lexicalSimilarity} \times 0.5) + (\text{departmentSimilarity} \times 0.3) + (\text{distanceSimilarity} \times 0.2)$$

1. **Distance Similarity**: Calculated using the Haversine formula:
   $$\text{distanceSimilarity} = 1.0 - \left(\frac{\text{distance}}{\text{GROUPING\_DISTANCE\_METERS}}\right)$$
2. **Department Similarity**: $1.0$ if the new complaint's AI department matches the job's current department, else $0.2$ (supporting cross-department grouping if text similarity is extremely high).
3. **Lexical Similarity**: A custom Jaccard overlap of normalized tokens:
   - Text is lowercased and stripped of punctuation and common stopwords.
   - Core issue synonyms are normalized (e.g., `pothole` & `road damage` map to `road_damage`; `water leak` & `pipe burst` map to `leakage`).
   - $$\text{lexicalSimilarity} = \frac{|\text{Tokens}_1 \cap \text{Tokens}_2|}{|\text{Tokens}_1 \cup \text{Tokens}_2|}$$

If the highest scoring job satisfies $\text{groupScore} \ge 0.5$, the complaint is merged into that job. If not, a new job is created.

### Grouping Limitations
- **Synonym Coverage**: Lexical synonym mapping is based on a defined dictionary mapping common city issue words. It does not replace a full semantic embeddings model or vector search, but is highly deterministic and lightweight.

---

## 🔒 4. AI Safety & Validation Pipeline

To ensure the system remains resilient against prompt injection, malformed data, or API failures:

1. **Prompt Injection Mitigation**: System instructions strictly isolate the user description as untrusted input. The model is instructed to extract facts only, ignoring any command strings.
2. **Schema & Value Validation**: The server subjects all AI suggestions (Gemini & Fallback) to a strict validation layer:
   - Department must exist in: `['Sanitation', 'Roads', 'Water', 'Electricity', 'Parks']`
   - Urgency must exist in: `['routine', 'urgent', 'emergency']`
   - Confidence must be a numeric float between `0.0` and `1.0`.
   - Summary length is strictly bounded (max 250 characters).
3. **8-Second Timeout**: Gemini fetch requests use an `AbortController` timeout of 8 seconds.
4. **Deterministic Fallback**: If the API rate limits, times out, is offline, or returns malformed JSON, the server seamlessly falls back to a regex-based local rules classifier, which parses keywords under the same validation rules.

---

## 🛡️ 5. Concurrency Controls & Race Conditions

### Atomic Job Claims
To prevent two crew members from claiming the same job simultaneously, we perform claims using MongoDB's atomic `findOneAndUpdate` operation:
```typescript
const job = await Job.findOneAndUpdate(
  {
    _id: jobId,
    department: authenticatedStaff.department,
    status: { $in: ['unassigned', 'assigned'] }
  },
  {
    $set: {
      status: 'claimed',
      assignedTo: authenticatedStaff.id,
      claimedAt: new Date()
    }
  },
  { new: true }
);
```
- Since MongoDB executes document updates atomically, only **one** request will match the `unassigned/assigned` state. The concurrent request will return `null` (no document modified), triggering a `409 Conflict` response to the client.

---

## 👑 6. Human Correction & Urgency Escalation

- **Field-Specific Human Override**: Admin edits are saved under the job's `humanCorrection` object. The active fields are updated to match the human correction, and the `adminReviewed` flag is set to `true`.
- **AI Modification Preservation**: When a new complaint joins a job, the system checks `adminReviewed`. If `true`, the active `department` and `summary` remain locked to the `humanCorrection` fields and are never overwritten by future AI runs.
- **Urgency Escalation Policy**: If a new complaint joins a job and has a higher priority urgency (e.g. `emergency` > `routine`), the job's active `urgency` is upgraded to ensure critical issues are escalated immediately.

---

## 🚪 7. Authorization & IDOR Defense

All security checks are validated strictly on the backend using decoded JWT identity parameters:
- **Citizen Isolation**: Citizens can only query their own complaints. The endpoint `GET /api/complaints/:complaintId` performs strict validation to verify that `complaint.citizen === req.user.id`.
- **Staff Isolation**: Staff can only claim, complete, or view jobs belonging to their assigned department. The department is extracted from the JWT token and validated inside all operations.
