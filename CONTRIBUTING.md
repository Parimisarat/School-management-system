# Contributing Guidelines

Thank you for contributing to the School Management System! To maintain code quality and ensure a smooth integration process, all developers must adhere to the following guidelines.

---

## 💻 Coding Standards & Rules

1. **Work Only in Your Feature Branches**: 
   - Never push directly to `main` or `dev`. Direct pushes to these branches are blocked by GitHub branch protection.
   - Only work on the feature branches assigned to your modules.
2. **Pull Requests (PRs) to `dev`**:
   - All completed features must be submitted via a Pull Request targeting the `dev` branch.
   - Use the Pull Request Template provided in `.github/pull_request_template.md`.
3. **Commit Messages**:
   - Write clear, concise commit messages.
   - Format: `[Feature/Fix/Docs] Short description of what changed` (e.g., `[feature/m3] Add onboarding form verification`).
4. **Keep Local Branches Synced**:
   - Regularly fetch and rebase/merge the latest changes from `dev` into your feature branch to minimize conflicts.
     ```bash
     git checkout dev
     git pull origin dev
     git checkout feature/mX-your-feature
     git merge dev
     ```

---

## 🚦 Pull Request Process

1. **Self-Review**: Test your module locally before raising a PR. Ensure no compile-time errors or broken tests.
2. **Raise PR**: Submit your PR targeting `dev`. Fill out the PR template completely.
3. **Notify Git Manager**: Sarat (Git Manager) will be assigned to review the PR.
4. **Address Feedback**: If changes are requested, apply them to your feature branch and push. The PR will update automatically.
5. **Merge**: Once approved and integration tests pass, Sarat will merge the PR into `dev`.

For a detailed step-by-step walkthrough, refer to [docs/git_workflow.md](docs/git_workflow.md).
