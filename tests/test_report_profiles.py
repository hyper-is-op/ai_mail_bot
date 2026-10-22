import unittest
import uuid
from app.api.analytics import (
    get_report_profiles_endpoint,
    create_report_profile_endpoint,
    delete_report_profile_endpoint,
    CreateReportProfileRequest
)

class TestReportProfiles(unittest.TestCase):
    def test_report_profiles_crud(self):
        test_client_id = "CLI-4B46C071"
        admin_user = {"role": "admin", "client_id": test_client_id}

        # 1. Fetch initial profiles (must contain 3 default profiles)
        initial = get_report_profiles_endpoint(test_client_id, admin_user)
        self.assertGreaterEqual(len(initial["profiles"]), 3)
        default_names = [p["name"] for p in initial["profiles"] if p["is_default"]]
        self.assertIn("Overview", default_names)
        self.assertIn("Quality & Sentiment", default_names)
        self.assertIn("Ops & Billing", default_names)

        # 2. Create custom profile
        test_name = f"Finance Audit {uuid.uuid4().hex[:4]}"
        created = create_report_profile_endpoint(
            test_client_id,
            CreateReportProfileRequest(name=test_name, columns=["timestamp", "customer_email", "cost"]),
            admin_user
        )
        self.assertEqual(created["name"], test_name)
        self.assertFalse(created["is_default"])
        self.assertEqual(created["columns"], ["timestamp", "customer_email", "cost"])

        # 3. Verify it is returned in list
        after_create = get_report_profiles_endpoint(test_client_id, admin_user)
        names = [p["name"] for p in after_create["profiles"]]
        self.assertIn(test_name, names)

        # 4. Delete profile
        deleted = delete_report_profile_endpoint(test_client_id, created["id"], admin_user)
        self.assertEqual(deleted["status"], "deleted")

        # 5. Verify it is removed
        after_delete = get_report_profiles_endpoint(test_client_id, admin_user)
        del_names = [p["name"] for p in after_delete["profiles"]]
        self.assertNotIn(test_name, del_names)

if __name__ == "__main__":
    unittest.main()
