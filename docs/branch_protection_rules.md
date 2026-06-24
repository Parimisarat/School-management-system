# Branch Protection Strategy

To ensure code safety, prevent accidental deletion, and guarantee that no untested code makes it to production, the Git Manager (Sarat) must configure the following Branch Protection Rules in GitHub.

---

## 🔒 1. Rules for `main` (Production Branch)

The `main` branch holds the stable, production-ready code. Direct changes are strictly prohibited.

### Required Settings on GitHub:
1. Go to **Settings** > **Branches** > **Branch protection rules** > Click **Add rule**.
2. **Branch name pattern**: `main`
3. **Protect matching branches**:
   - [x] **Require a pull request before merging**
     - [x] **Require approvals**: Set to `1` approval (Git Manager's review).
     - [x] **Dismiss stale pull request approvals when new commits are pushed**: Prevents old reviews from carrying over to modified code.
   - [x] **Require status checks to pass before merging** (if CI/CD pipeline is set up).
   - [x] **Require conversation resolution before merging**: All comments and discussions must be resolved.
   - [x] **Restrict who can push to matching branches**: Ensure only the Git Manager (`Sarat`) can push/merge.

---

## 🛠️ 2. Rules for `dev` (Integration Branch)

The `dev` branch is where features are integrated and tested before moving to production. Developers work in feature branches and submit PRs to `dev`.

### Required Settings on GitHub:
1. Go to **Settings** > **Branches** > **Branch protection rules** > Click **Add rule**.
2. **Branch name pattern**: `dev`
3. **Protect matching branches**:
   - [x] **Require a pull request before merging**
     - [x] **Require approvals**: Set to `1` approval (Git Manager must approve).
   - [x] **Require status checks to pass before merging** (if automated test suite is configured).
   - [x] **Require conversation resolution before merging**.
   - [x] **Restrict who can push to matching branches**: Limit direct push access only to the Git Manager (`Sarat`). Normal developers can only merge via approved PRs.

---

## 📋 Summary of Rights & Workflow Permissibility

| Action | Developer (Manju, Vishnu, Praveen) | Git Manager (Sarat) |
| :--- | :---: | :---: |
| Push to `feature/*` | **Allowed** | **Allowed** |
| Push directly to `dev` | ❌ Blocked | **Allowed** |
| Push directly to `main` | ❌ Blocked | ❌ Blocked (Must merge via PR) |
| Review & Approve PRs | ❌ No admin merge rights | **Allowed** |
| Perform integration testing | Local testing | Final integration testing |
| Release tagging | ❌ Not permitted | **Allowed** (v1.0.0) |
