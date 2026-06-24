# Git Workflow Guide for Team Members

Follow this workflow step-by-step for all features, bug fixes, and modifications.

---

## 🔄 Lifecycle of a Feature

### Step 1: Clone and Synchronize
Ensure you have the latest code from `dev`:
```bash
# Shift to integration branch
git checkout dev

# Pull latest changes from remote
git pull origin dev
```

### Step 2: Create a Feature Branch
Create a branch named after your assigned feature (refer to `README.md` for exact branch names):
```bash
# Format: feature/mX-name
git checkout -b feature/m3-onboarding
```

### Step 3: Implement & Commit
Work on your code. Commit your changes incrementally with clear messages:
```bash
# Add files to staging
git add .

# Commit with a concise message
git commit -m "[feature/m3] Design staff onboarding form component"
```

### Step 4: Keep Branch Updated
Before raising a PR, ensure there are no changes on `dev` that conflict with your code:
```bash
# Pull the latest dev changes into your local dev branch
git checkout dev
git pull origin dev

# Go back to your feature branch and merge dev
git checkout feature/m3-onboarding
git merge dev
```
*If conflicts arise, follow the conflict resolution guide in [docs/merge_conflict_resolution.md](merge_conflict_resolution.md).*

### Step 5: Push Branch and Open a Pull Request
Push your feature branch to the remote repository:
```bash
git push origin feature/m3-onboarding
```
1. Navigate to the GitHub repository page.
2. Click **New Pull Request**.
3. Set **base: `dev`** and **compare: `feature/m3-onboarding`**.
4. Use the Pull Request Template to describe your changes.
5. Assign **Sarat** as the reviewer.

---

## 🚀 Release Lifecycle (Git Manager Only)

Once all modules are completed, reviewed, and integrated:
1. **Prepare Release**: Sarat pulls all changes locally and performs final integration testing on `dev`.
2. **Merge to Main**:
   ```bash
   git checkout main
   git pull origin main
   git merge dev --no-ff -m "Release: Integration of all modules for v1.0.0"
   ```
3. **Create Release Tag**:
   ```bash
   git tag -a v1.0.0 -m "School Management System Version 1.0.0 Release"
   git push origin main --tags
   ```
