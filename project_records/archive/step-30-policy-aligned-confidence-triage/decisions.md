# Step 30: Decisions - Policy-Aligned Confidence Triage

### 1. Dynamic Threshold Alignment vs Static Arbitrary Tiers
- **Options Considered**:
  - *Option A*: Maintain static 85/70 brackets.
  - *Option B*: Dynamically evaluate emails against the client's configured `email_accounts.score_threshold` (e.g. 75%, 80%, 90%) for policy compliance, coupled with an objective 60% hallucination floor.
- **Decision**: Option B. Static 85/70 was disconnected from the actual dispatch logic. Evaluating against `score_threshold` tells operators exactly how many emails met the auto-send policy versus how many were diverted to review.

### 2. Separating Policy Compliance from Objective Hallucination Risk
- **Options Considered**:
  - *Option A*: Scale all tiers relative to threshold (e.g. `threshold - 15`).
  - *Option B*: Keep a fixed risk floor at `< 60%` for ungrounded/hallucinatory output while using `threshold` for policy qualification.
- **Decision**: Option B. Model confidence calibration is independent of user policy. If an operator sets a lenient 50% threshold, a 52% email may be policy-approved, but it remains objectively low signal. The dashboard must flag the risk floor regardless of threshold.
