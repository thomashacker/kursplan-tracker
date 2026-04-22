"""
Quick environment check — run with: uv run python check_env.py
Tests Supabase connectivity and SMTP login without sending anything.
"""
import smtplib
import sys

OK = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m!\033[0m"


def check(label: str, fn):
    try:
        fn()
        print(f"  {OK}  {label}")
        return True
    except Exception as e:
        print(f"  {FAIL}  {label}")
        print(f"       {e}")
        return False


def main():
    print("\n── Backend environment check ──\n")
    failures = 0

    # 1. Load config
    try:
        from app.config import settings
        print(f"  {OK}  Config loaded")
    except Exception as e:
        print(f"  {FAIL}  Config failed to load: {e}")
        sys.exit(1)

    # 2. Supabase reachable
    def test_supabase():
        from app.services.supabase import get_supabase
        sb = get_supabase()
        # Simple ping: list tables (will return empty if no rows, that's fine)
        sb.table("clubs").select("id").limit(1).execute()

    if not check("Supabase connection", test_supabase):
        failures += 1

    # 3. SMTP login (no email sent)
    def test_smtp():
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)

    if not check(f"SMTP login ({settings.smtp_host}:{settings.smtp_port})", test_smtp):
        failures += 1

    # 4. JWT secret looks non-empty
    def test_jwt():
        assert len(settings.supabase_jwt_secret) > 10, "JWT secret too short"

    if not check("JWT secret set", test_jwt):
        failures += 1

    # 5. Summary
    print()
    if failures == 0:
        print("  All checks passed — ready to run.\n")
    else:
        print(f"  {failures} check(s) failed — fix the errors above before starting.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
