# School Management System

Welcome to the School Management System (SMS) repository. This project is a comprehensive platform designed to streamline administrative tasks, academic tracking, communication, and overall school operations.

---

## 📅 Project & Team Roles

| Role | Name | Responsibilities / Assigned Modules |
| :--- | :--- | :--- |
| **Git Manager & Repository Owner** | **Sarat** | Maintain main repository, set up branch strategy, review PRs, resolve merge conflicts, maintain CHANGELOG.md/README.md, perform integration testing, merge dev into main. |
| **Developer** | **Sarat** | `feature/m9-db-auth` (Database & Auth)<br>`feature/m1-enquiry` (Enquiry Management)<br>`feature/m2-admission` (Admission System) |
| **Developer** | **Manju** | `feature/m3-onboarding` (Student/Staff Onboarding)<br>`feature/m4-homework` (Homework & Assignments) |
| **Developer** | **Vishnu** | `feature/m5-ptm` (PTM Scheduler & Feedback)<br>`feature/m6-activities` (Co-curricular Activities) |
| **Developer** | **Praveen** | `feature/m7-discipline` (Discipline & Behavior Tracking)<br>`feature/m8-communication` (School-wide Announcements) |

---

## 🌿 Branching Strategy

This project uses a modified Git Flow branching strategy:
- `main` **(Production)**: Protected branch. Only contains stable, tested release code. Direct pushes are disabled.
- `dev` **(Integration)**: The integration branch where all finished features are merged. Direct pushes are disabled for developers; only the Git Manager merges PRs here.
- `feature/*` **(Feature Branches)**: Developers must work only in their designated feature branches:
  - Sarat: `feature/m9-db-auth`, `feature/m1-enquiry`, `feature/m2-admission`
  - Manju: `feature/m3-onboarding`, `feature/m4-homework`
  - Vishnu: `feature/m5-ptm`, `feature/m6-activities`
  - Praveen: `feature/m7-discipline`, `feature/m8-communication`

For workflow guidelines, see [docs/git_workflow.md](docs/git_workflow.md).

---

## 📁 Repository Structure

```text
school-management-system/
├── .github/
│   └── pull_request_template.md     # PR template for developers
├── docs/
│   ├── branch_protection_rules.md   # Setup guide for branch protection
│   ├── git_workflow.md              # Git workflow instructions for the team
│   └── merge_conflict_resolution.md # Step-by-step conflict resolution guidelines
├── src/                             # Source code folder
│   ├── auth/                        # Sarat (m9-db-auth)
│   ├── enquiry/                     # Sarat (m1-enquiry)
│   ├── admission/                   # Sarat (m2-admission)
│   ├── onboarding/                  # Manju (m3-onboarding)
│   ├── homework/                    # Manju (m4-homework)
│   ├── ptm/                         # Vishnu (m5-ptm)
│   ├── activities/                  # Vishnu (m6-activities)
│   ├── discipline/                  # Praveen (m7-discipline)
│   └── communication/               # Praveen (m8-communication)
├── CHANGELOG.md                     # History of changes (maintained by Git Manager)
├── CONTRIBUTING.md                  # Guidelines for contributions
└── README.md                        # Project documentation (this file)
```

---

## 🚀 Getting Started

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd school-management-system
   ```
2. **Checkout to dev**:
   ```bash
   git checkout dev
   ```
3. **Create your feature branch**:
   ```bash
   git checkout -b feature/mX-your-feature
   ```

Refer to the [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/git_workflow.md](docs/git_workflow.md) for full instructions before you start committing code!
