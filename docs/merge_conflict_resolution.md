# Merge and Conflict Resolution Guidelines

Merge conflicts happen when changes are made to the same line of a file on two different branches, or when a file is deleted in one branch but modified in another. This guide outlines how to handle conflicts safely.

---

## 🛠️ Resolving Conflicts in Feature Branches (Developers)

When you pull or merge `dev` into your feature branch and Git reports a conflict:

### 1. Identify Conflicted Files
Git will list the files containing conflicts. You can also view them by running:
```bash
git status
```
Look under the section: `Unmerged paths:`.

### 2. Locate Conflict Markers
Open the conflicted files in your code editor. Search for the conflict markers:
- `<<<<<<< HEAD` : Shows changes in your current feature branch.
- `=======` : Separation line.
- `>>>>>>> dev` : Shows changes coming from the `dev` branch.

**Example**:
```text
<<<<<<< HEAD
const dbConnection = connectToLocalDB();
=======
const dbConnection = connectToProductionDB();
>>>>>>> dev
```

### 3. Resolve the Conflicts
Decide which code to keep (or write a combined version). Delete the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).

For example, to keep the production version:
```javascript
const dbConnection = connectToProductionDB();
```

### 4. Stage and Commit
After resolving conflicts in all files:
```bash
# Add resolved files to stage
git add <file-name>

# Commit the merge
git commit -m "Resolve merge conflict with dev"
```

---

## 🛡️ Resolving Conflicts During PR Integration (Git Manager)

If a Pull Request has conflicts with the `dev` branch:

### Option A: Let Developer Resolve (Preferred)
As the Git Manager, request the developer to update their branch locally against `dev` by running:
```bash
git checkout feature/your-branch
git pull origin dev
# Developer resolves conflicts locally, commits, and pushes.
```

### Option B: Git Manager Resolves Manually
If you need to resolve it quickly yourself:
1. Fetch and checkout the developer's branch locally:
   ```bash
   git fetch origin
   git checkout -b feature/developer-branch origin/feature/developer-branch
   ```
2. Merge `dev` into it:
   ```bash
   git merge dev
   ```
3. Resolve the conflicts in your editor.
4. Add, commit, and push back to their feature branch:
   ```bash
   git add .
   git commit -m "Resolve conflicts with dev branch"
   git push origin feature/developer-branch
   ```
5. Merge the approved Pull Request on GitHub.
