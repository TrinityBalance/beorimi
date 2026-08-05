import unittest

from fastapi.testclient import TestClient

from vlm.app.main import app


class HealthEndpointTests(unittest.TestCase):
    def test_health(self) -> None:
        response = TestClient(app).get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "vlm"})


if __name__ == "__main__":
    unittest.main()
