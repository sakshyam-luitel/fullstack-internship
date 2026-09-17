# Academic Research Management System (ARMS)

ARMS runs a department's student research from start to finish: the research timeline, proposals, supervision, progress reports, final reports, defenses and defense panels. Students, professors and administrators each get their own workspace, and everyone involved is notified when something changes.

This guide covers:

1. [Setting up the application](#1-setting-up-the-application)
2. [Roles at a glance](#2-roles-at-a-glance)
3. [Super admin guide](#3-super-admin-guide)
4. [Department admin guide](#4-department-admin-guide)
5. [Student guide](#5-student-guide)
6. [Professor guide](#6-professor-guide)
7. [How a piece of research moves through the system](#7-how-a-piece-of-research-moves-through-the-system)
8. [Rules worth knowing](#8-rules-worth-knowing)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Setting up the application

ARMS has three parts: a PostgreSQL database, a FastAPI + GraphQL backend (`backend/`), and a React frontend (`frontend/Academic Research Management System/`).

### Option A: Docker (simplest)

From the repository root:

```bash
docker compose up --build
```

| Service  | Address                 |
| -------- | ----------------------- |
| Frontend | http://localhost:5173   |
| Backend  | http://127.0.0.1:8000   |
| Database | localhost:5432          |

The database credentials and `SECRET_KEY` come from `docker-compose.yml`. Change `SECRET_KEY` before using the application for real.

### Option B: Run each part locally

**Requirements:** Python 3.13 with [uv](https://docs.astral.sh/uv/), Node.js 22, and PostgreSQL 16.

**Backend**

1. Create `backend/.env`:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/AcademicResearchManagementSystem
   SECRET_KEY=replace-with-a-long-random-string
   ```

2. Install dependencies, apply the database migrations and start the server:

   ```bash
   cd backend
   uv sync
   uv run alembic upgrade head
   uv run fastapi dev app/main.py
   ```

   The backend listens on http://127.0.0.1:8000. If it seems to hang on start-up, it is waiting for PostgreSQL to become reachable.

**Frontend**

```bash
cd "frontend/Academic Research Management System"
npm install
npm run dev
```

Open http://localhost:5173. If that port is busy, Vite picks the next free one and prints it.

### Creating the first super admin

No account can be created from the website until a super admin exists, so add the first one from the `backend/` folder:

```bash
uv run python -c "from app.database import SessionLocal; from app import models; from app.utils import get_password_hash; db = SessionLocal(); db.add(models.User(name='Super Admin', email='superadmin@example.com', password=get_password_hash('change-this-password'), role=models.Role.super_admin)); db.commit()"
```

With Docker, run the same command inside the backend container, prefixed with `docker compose exec backend`.

Then sign in at http://localhost:5173 with that email and password.

---

## 2. Roles at a glance

| Role | Who | What they do |
| --- | --- | --- |
| **Super admin** | System owner | Creates departments and one department admin for each |
| **Department admin** | Department office | Manages the department's people, degree programs and clusters, the research timeline, proposal assignment and defenses |
| **Student** | Bachelor's, Master's or PhD student | Submits proposals, progress reports and final submissions, and follows their defenses |
| **Professor** | Supervisor or panel member | Reviews what their students submit and sits on defense panels |

Everyone signs in on the same login page with their email and password (the email is not case-sensitive). After signing in, each person lands on their own workspace. In every workspace:

- **My profile** shows account details. Click the camera icon next to your photo to upload a profile picture (PNG, JPEG, GIF or WEBP, up to 5 MB).
- **The bell** (students and professors) lists notifications. Opening it marks them as read.
- **Log out** is at the bottom of the left menu.

---

## 3. Super admin guide

The left menu has **Users** and **Departments**.

1. **Create departments.** In **Departments**, click **Create department** and enter a name and code (e.g. *Department of Electronics Engineering*, *ELX*). Departments can be edited or deleted from the same table.
2. **Create a department admin for each department.** In **Users**, click **Create Department Admin**, fill in the name, email and password, and choose the department.

Everything else is run by the department admins.

---

## 4. Department admin guide

The left menu has **Users**, **Research tools** and **My profile**. Everything you see is limited to your own department.

### 4.1 Set up the department

Open **Research tools**.

- **Degree programs:** create the programs your department offers, each with a level: Bachelor's, Master's or PhD. (A program is also created automatically when you create a student at a level the department doesn't have yet; see below.)
- **Clusters:** optional research areas you can attach to a proposal when assigning it.

### 4.2 Users and profiles

Open **Users**. People are split into **Professors**, **Students** and **Other**. Students are split again into **Bachelor's students**, **Master's students** and **PhD students**. A **Level not set** tab appears if a student has no degree program. The **Accounts / Profiles** switch changes what the table shows.

**Create an account:** click **Create User**, then enter the name, email and password (at least 8 characters) and choose the role.

- For a **student**, choose the **degree level** and, if the department has more than one program at that level, the **degree program**. If the department has no program at that level yet, one is created for you (e.g. *Master's in Electronics Engineering*).
- After saving, the page switches to the new person's group and confirms who was created.
- An email can only be used once.

**Edit an account:** click the pencil icon next to the user. You can change the name, email and password, and a student's degree level or program.

**Profiles** (switch to **Profiles**):

- **Professor profile:** academic rank and maximum number of students. **A professor needs a profile before they can be added to a defense panel.** The maximum is also respected when assigning proposals.
- **Student profile:** roll number, degree program and supervisor. A student profile is also created automatically when the student submits a proposal.

Rows without a profile show **Create profile**; the pencil icon edits an existing one.

### 4.3 Research timeline & defenses

Open **Research tools → Research timeline & defenses**. First choose the **degree level** (Bachelor's, Master's or PhD) at the top. Everything below applies only to that level. A number on a level tab means proposals at that level are waiting for a supervisor.

#### Research timeline

A timeline is an ordered list of **phases**. Students can only submit while the matching phase is open.

| Phase type | What it controls |
| --- | --- |
| **Proposal** | When students can create and submit proposals |
| **Progress report** | One review round. Add one phase per round (Progress report 1, 2, 3, …) |
| **Final defense** | The shared defense day. Final reports can be submitted once this phase exists |

To add a phase, click **Add research phase**, then choose the stage, degree level and step number, give it a title, and set:

- **Opens at** and **Deadline** for proposal and progress report phases, plus **Allow late submissions** if students may still submit after the deadline; or
- **Defense day** for a final defense phase.

Saving notifies the people involved:

- **Proposal phase:** that level's students and every professor in the department.
- **Other phases:** that level's students plus their supervisors, co-authors and panel members.

Editing a phase's dates notifies them again.

**Delete a phase:** the trash icon becomes available once the phase is over (after its deadline, or after the defense day). The phase disappears from every dashboard, but its submissions and history stay on record.

#### Proposal assignment

The table lists the level's proposals.

1. Click **Assign proposal** (or the pencil icon on a row).
2. Choose the **student proposal**, the **professor** and, optionally, a **cluster**.
   - A professor who can't take the proposal is shown greyed out with the reason. The limits are one Bachelor's group, 5 Master's students, 4 PhD students, 12 students in total, and the professor's own maximum.
   - For Bachelor's proposals you can also add or remove group members. Master's and PhD proposals are individual.
3. Save. The proposal becomes **assigned** and appears in that professor's dashboard for review.

A proposal the professor has **rejected** can be deleted with the trash icon. It stays visible in everyone's history as deleted.

#### Defenses

Every proposal, progress report and approved final report can be defended.

1. Choose **Proposal defenses**, **Progress report defenses** or **Final defenses**.
2. The upper list shows what can be defended at this level, with its students, supervisor and current defense (if any).
3. Click **Plan defense** (or **Reschedule**) and fill in:
   - **Date:** for final defenses this is pre-filled with the timeline's defense day;
   - **Time** and **Location**;
   - **Defense panel:** tick the professors; the supervisor is marked. Only professors with a professor profile are listed.
4. Save. The students, supervisor, co-authors and panel are notified, and the defense appears on the student's and professor's report.

The lower table lists planned defenses with their date, time, location, panel and status. **Edit** changes the slot or panel. Rescheduling notifies everyone again.

---

## 5. Student guide

The left menu has **My profile** and **Research space**. The research space has four tabs:

- **Proposal**
- **Progress reports**
- **Final submission**
- **Defenses**

A number on a tab means something needs your attention. Each tab shows whether its phase is open, and until when.

All documents must be **PDF files of up to 20 MB**.

### 5.1 Proposal

1. When the proposal phase is open, click **New proposal**.
2. Enter a title and attach the proposal PDF.
   - **Bachelor's students** may invite up to 2 classmates from the same program. Invited students accept or decline from the banner at the top of their own Proposal tab. Every invitee must respond before the proposal can be submitted.
   - **Master's and PhD proposals are individual**, with no group members.
3. Click **Save draft** to finish later, or **Submit for review**.

What happens next:

| Status | Meaning | What you do |
| --- | --- | --- |
| Draft | Only you (and your group) can see it | **Continue & submit** |
| Submitted | Waiting for the department to assign a supervisor | Wait |
| Assigned | A supervisor will review it | Wait |
| Changes requested | The supervisor wants changes | **Address feedback**: describe what you changed and optionally attach a revised PDF |
| Approved | Your research paper is created; progress reports and the final submission are unlocked | Continue with progress reports |
| Rejected | Not accepted | Click **New proposal** to start again, even if the proposal deadline has passed |

**History** shows every submission and review of the proposal. **Group** (Bachelor's drafts) manages invitations.

### 5.2 Progress reports

Available once your proposal is approved.

1. When a progress report round is open, click **New progress report**.
2. Write a progress summary and attach the report PDF.
3. **Save draft** or **Submit to supervisor**.

You submit one report per round. If your supervisor asks for changes, use **Revise & resubmit**. If a report is **rejected**, you may submit a replacement for that round, even after its deadline.

### 5.3 Final submission

1. **Step 1, final report:** once your department has scheduled the final defense phase, click **Submit final report** and attach the PDF. If your supervisor requests changes or rejects it, you can resubmit.
2. **Step 2, final defense:** after the final report is approved, the department plans your defense. Click **Submit final thesis**, attach the PDF and confirm. The thesis can't be replaced after submission.

### 5.4 Defenses

The **Defenses** tab lists every defense planned for you, upcoming first. Each one shows:

- which report is being defended (proposal, progress report or final report) and its title;
- the **date, time and location**;
- the panel members;
- the result once it's recorded.

The same defense details also appear under the related proposal or report.

---

## 6. Professor guide

The left menu has **My profile** and **Research space**. The research space has four tabs:

- **Proposals**
- **Progress reports**
- **Final submissions**
- **Defense panels**

A number on a tab counts items waiting for your review.

### 6.1 Proposals

Proposals assigned to you are split into **Bachelor's**, **Master's** and **PhD proposals**. For each one you can:

- **View** or **Download** the proposal PDF;
- click **Review** and choose **Approved**, **Changes requested** or **Rejected**, with an optional comment for the students;
- use **Approve** when students have addressed your requested changes and you just want to accept the correction.

Approving a proposal creates the students' research paper.

### 6.2 Progress reports

Reports from your supervised papers, grouped by paper and labelled with their round. Open the PDF, then **Review**: approve, request changes or reject, with a comment.

### 6.3 Final submissions

For each supervised paper, review the **final report** the same way. Once you approve it, the department can plan the final defense, which is also shown here with its slot and the student's thesis once submitted.

### 6.4 Defense panels

Every defense you sit on, split into **Bachelor's**, **Master's** and **PhD defense**. Each card shows:

- the report being defended (proposal, progress report or final report) and the project title;
- the students and their supervisor;
- the **date, time and location**;
- the full panel;
- **View / Download** for the report you are assessing, plus the final thesis for final defenses.

You are notified whenever you are added to a panel or a defense is rescheduled.

---

## 7. How a piece of research moves through the system

```text
Department admin          Student                         Professor (supervisor)
----------------          -------                         ----------------------
Add proposal phase  ───►  Create & submit proposal
Assign supervisor   ───────────────────────────────────►  Review proposal
                          ◄── changes requested / rejected ──┘
                          Approved → research paper created
Add progress rounds ───►  Submit progress report  ──────►  Review report
Plan defenses       ───►  (proposal / progress defenses, with panel)
Add final defense   ───►  Submit final report     ──────►  Review final report
Plan final defense  ───►  Submit final thesis
                          Defense takes place in front of the panel
```

---

## 8. Rules worth knowing

- **Phases control submissions.** Students can only create proposals and progress reports while the matching phase is open, and final reports once a final defense phase exists. "Allow late submissions" keeps a phase open after its deadline.
- **Group work:** only Bachelor's proposals can have groups (up to 3 students, all from the same program). Master's and PhD proposals are individual.
- **One active proposal per student.** A rejected, withdrawn or deleted proposal frees the student (and their group) to start again.
- **Resubmission after rejection** is always allowed for proposals, progress reports and final reports, in the same phase, even after its deadline.
- **Documents are locked once submitted.** A PDF can only be replaced while the item is a draft or has requested changes.
- **Supervision limits:** one Bachelor's group, 5 Master's students, 4 PhD students and 12 students in total per professor, and never more than the professor's own maximum.
- **Defense panels** can only include professors who have a professor profile. Panel members may open the documents they assess.
- **Deleted phases** are hidden, not erased. Everything submitted in them stays on record.
- **Defense results** (passed / not passed) are shown when recorded, but there is no screen for recording them yet. For now this is done through the `recordDefenseOutcome` API mutation, as a department admin.

---

## 9. Troubleshooting

| Problem | What to do |
| --- | --- |
| *"No proposal phase is scheduled for your degree level"* | The department admin needs to add (or reopen) a proposal phase for that level |
| *"… has no degree program on file"* | The department admin edits the student in **Users** and chooses a degree level |
| A student is listed under **Level not set** | Same as above |
| *"… needs a professor profile before joining a defense panel"* | Create the professor's profile in **Users → Professors → Profiles** |
| A professor is greyed out when assigning a proposal | The reason is shown next to their name (for example, their supervision limit is reached) |
| A new student doesn't appear in the list | Check the student's degree-level tab. The page switches to it automatically after creating a user |
| *"A user with the email … already exists"* | That email is already registered; edit the existing account instead |
| The page loads but shows no data | Make sure the backend is running on port 8000 and that `uv run alembic upgrade head` has been run |

---

## Internship learning log

Month 1

What I've learned:
1. React , Tailwindcss , Responsive Design
2. Graphql queries , mutations , authentication using Bearer Token
3. Rest api , Graphql api
4. Database connection using psycopg and writing queries with sqlalchemy orms
5. Wrote dockerfile and dockercompose and containerized application
6. containerized multiple application individually by building dockerfile and also by dockercompose
7. Handled CRUD opeartion in both REST and GraphQL using Fastapi
8. Used Role Based Access Control(RBAC) using permission classes
