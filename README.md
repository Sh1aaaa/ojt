# Employee Time In / Time Out System

A Flask (Python) employee attendance web app designed for **Vercel + GitHub + Supabase**.

## Included features

- Employee sign-in using Supabase Authentication (email and password)
- Time in and time out buttons
- One attendance record per employee per Philippine calendar day
- Duplicate time-in and invalid time-out protection in PostgreSQL
- Employee can view only their own latest 30 attendance records
- Philippine time (`Asia/Manila`) for work dates and display
- Responsive dashboard for desktop and mobile

## 1. Create the Supabase database

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Open `supabase/schema.sql` from this project, copy all its contents, and run it.
4. In **Authentication → Users**, create an account for each employee. Use the employee's email and a temporary password.
5. In each user's metadata, optionally add `full_name`, for example:
   ```json
   { "full_name": "Juan Dela Cruz" }
   ```
6. Give employees their login credentials securely. Do not put the Supabase service-role key in this project.

## 2. Configure environment variables

In your Supabase project, open **Project Settings → API** and copy:
- Project URL
- `anon` / publishable key

In Vercel, open your project **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/publishable key |
| `FLASK_SECRET_KEY` | A long, random secret string |

Set these for Production (and Preview if needed). Never use the `service_role` key as the anon key. Never commit secrets to GitHub.

You can generate a secret locally with:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## 3. Deploy with GitHub and Vercel

1. Create a GitHub repository.
2. Upload all project files and folders, keeping the structure unchanged.
3. In Vercel, choose **Add New → Project** and import that GitHub repository.
4. Vercel should detect the Python function from `api/index.py`. Keep the root directory set to the repository root.
5. Add the three environment variables above in Vercel project settings.
6. Deploy. For future updates, push commits to GitHub and Vercel will redeploy automatically.

## 4. Run locally (optional)

```bash
python -m venv .venv
# Windows:
.venv\\Scripts\\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your values. Then load the variables into your shell (or use a local dotenv runner) and run:

```bash
python app.py
```

Open `http://127.0.0.1:5000`.

## Attendance behavior

- Time in creates today's record using the server's timestamp.
- Time out updates today's open record.
- The database enforces one record per employee per Manila date.
- Employees cannot submit arbitrary timestamps from the browser.
- RLS limits attendance history to the signed-in employee.
- An employee cannot directly insert, edit, or delete attendance through the table API.

## Important production notes

- This is an employee self-service version; it does not include an admin dashboard, employee management screen, payroll computation, shift schedules, overtime, break tracking, or attendance correction/approval workflow.
- The app stores the Supabase access token in Flask's signed session cookie. Use a strong `FLASK_SECRET_KEY` and HTTPS (Vercel provides HTTPS).
- For a larger deployment, consider server-side session storage, password reset flows, audit logs, and an admin role with separately enforced database policies.
- Verify your organization's attendance and privacy requirements before using it for official payroll.
