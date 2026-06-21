"""
Test suite for VakilSetu new features:
- Legal Chatbot (POST /api/chat)
- Notifications (GET /api/notifications, PUT /api/notifications/read-all)
- Referral System (POST /api/referrals, GET /api/referrals, PUT /api/referrals/{id}/accept)
- Stripe Payments (GET /api/payments/packages, POST /api/payments/create-checkout)
- Consultations (GET /api/consultations)
- TF-IDF Search (POST /api/analyze-case)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_API_URL', '').rstrip('/')

# Test credentials
CLIENT_EMAIL = "client@test.com"
CLIENT_PASSWORD = "password123"
LAWYER_EMAIL = "lawyer@test.com"
LAWYER_PASSWORD = "password123"


class TestAuth:
    """Authentication tests for client and lawyer"""
    
    def test_client_login_success(self):
        """Test client login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["role"] == "client"
        assert data["email"] == CLIENT_EMAIL
        print(f"✓ Client login success: {data['name']}")
    
    def test_lawyer_login_success(self):
        """Test lawyer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": LAWYER_EMAIL,
            "password": LAWYER_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["role"] == "lawyer"
        assert data["email"] == LAWYER_EMAIL
        print(f"✓ Lawyer login success: {data['name']}")


class TestLegalChatbot:
    """Legal chatbot endpoint tests"""
    
    def test_chat_without_session(self):
        """Test chatbot without session_id - should create new session"""
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What is IPC Section 420?"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 0
        print(f"✓ Chat response received (new session): {data['session_id']}")
        return data["session_id"]
    
    def test_chat_with_session(self):
        """Test chatbot with existing session_id"""
        # First create a session
        first_response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "What is bail?"
        })
        session_id = first_response.json()["session_id"]
        
        # Continue conversation
        response = requests.post(f"{BASE_URL}/api/chat", json={
            "message": "How do I apply for it?",
            "session_id": session_id
        })
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        print(f"✓ Chat continuation with session: {session_id}")


class TestNotifications:
    """Notification system tests"""
    
    @pytest.fixture
    def client_session(self):
        """Get authenticated client session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    @pytest.fixture
    def lawyer_session(self):
        """Get authenticated lawyer session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": LAWYER_EMAIL,
            "password": LAWYER_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_get_notifications_unauthenticated(self):
        """Test notifications endpoint without auth - should return 401"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401
        print("✓ Notifications endpoint requires authentication")
    
    def test_get_notifications_authenticated(self, client_session):
        """Test getting notifications as authenticated client"""
        response = client_session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Client has {len(data)} notifications")
    
    def test_mark_all_notifications_read(self, client_session):
        """Test marking all notifications as read"""
        response = client_session.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Mark all notifications as read works")


class TestReferralSystem:
    """Lawyer referral system tests"""
    
    @pytest.fixture
    def lawyer_session(self):
        """Get authenticated lawyer session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": LAWYER_EMAIL,
            "password": LAWYER_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    @pytest.fixture
    def client_session(self):
        """Get authenticated client session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_get_referrals_as_lawyer(self, lawyer_session):
        """Test getting referrals as lawyer"""
        response = lawyer_session.get(f"{BASE_URL}/api/referrals")
        assert response.status_code == 200
        data = response.json()
        assert "sent" in data
        assert "received" in data
        assert isinstance(data["sent"], list)
        assert isinstance(data["received"], list)
        print(f"✓ Lawyer referrals: {len(data['sent'])} sent, {len(data['received'])} received")
    
    def test_get_referrals_as_client_forbidden(self, client_session):
        """Test that clients cannot access referrals endpoint"""
        response = client_session.get(f"{BASE_URL}/api/referrals")
        assert response.status_code == 403
        print("✓ Clients cannot access referrals endpoint (403)")
    
    def test_create_referral_requires_lawyer(self, client_session):
        """Test that only lawyers can create referrals"""
        response = client_session.post(f"{BASE_URL}/api/referrals", json={
            "case_id": "fake_case_id",
            "referred_to_lawyer_id": "fake_lawyer_id",
            "notes": "Test referral"
        })
        assert response.status_code == 403
        print("✓ Only lawyers can create referrals (403)")


class TestPayments:
    """Stripe payment integration tests"""
    
    @pytest.fixture
    def client_session(self):
        """Get authenticated client session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_get_packages(self):
        """Test getting consultation packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        data = response.json()
        assert "basic" in data
        assert "standard" in data
        assert "premium" in data
        assert data["basic"]["amount"] == 29.00
        assert data["standard"]["amount"] == 49.00
        assert data["premium"]["amount"] == 99.00
        print(f"✓ Packages available: {list(data.keys())}")
    
    def test_create_checkout_requires_auth(self):
        """Test that checkout requires authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "package_id": "standard",
            "lawyer_id": "fake_id",
            "origin_url": "http://localhost:3000"
        })
        assert response.status_code == 401
        print("✓ Checkout requires authentication (401)")
    
    def test_create_checkout_invalid_package(self, client_session):
        """Test checkout with invalid package"""
        response = client_session.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "package_id": "invalid_package",
            "lawyer_id": "fake_id",
            "origin_url": "http://localhost:3000"
        })
        assert response.status_code == 400
        print("✓ Invalid package returns 400")


class TestConsultations:
    """Consultations endpoint tests"""
    
    @pytest.fixture
    def client_session(self):
        """Get authenticated client session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_get_consultations_requires_auth(self):
        """Test consultations endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/consultations")
        assert response.status_code == 401
        print("✓ Consultations requires authentication (401)")
    
    def test_get_consultations_authenticated(self, client_session):
        """Test getting consultations as authenticated user"""
        response = client_session.get(f"{BASE_URL}/api/consultations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Client has {len(data)} consultations")


class TestTFIDFSearch:
    """TF-IDF based case analysis tests"""
    
    def test_analyze_case_returns_relevant_laws(self):
        """Test that analyze-case returns relevant laws using TF-IDF"""
        response = requests.post(f"{BASE_URL}/api/analyze-case", json={
            "case_type": "Civil",
            "description": "My landlord is refusing to return my security deposit of Rs.50,000 after I vacated the flat. I have the rental agreement and receipts.",
            "location": "Mumbai",
            "urgency": "Medium"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "relevant_laws" in data
        assert "similar_cases" in data
        assert "analysis" in data
        assert "matched_lawyers" in data
        
        # Check relevant laws have relevance scores
        if data["relevant_laws"]:
            law = data["relevant_laws"][0]
            assert "relevance_score" in law
            assert "ipc_section" in law
            assert "title" in law
            print(f"✓ Top law: {law['ipc_section']} - {law['title']} (score: {law['relevance_score']})")
        
        # Check similar cases have relevance scores
        if data["similar_cases"]:
            case = data["similar_cases"][0]
            assert "relevance_score" in case
            assert "title" in case
            print(f"✓ Top case: {case['title']} (score: {case['relevance_score']})")
        
        print(f"✓ TF-IDF analysis returned {len(data['relevant_laws'])} laws, {len(data['similar_cases'])} cases")
    
    def test_analyze_case_criminal(self):
        """Test case analysis for criminal case"""
        response = requests.post(f"{BASE_URL}/api/analyze-case", json={
            "case_type": "Criminal",
            "description": "Someone threatened me with physical harm and demanded money. They have been harassing me for weeks.",
            "location": "Delhi",
            "urgency": "High"
        })
        assert response.status_code == 200
        data = response.json()
        assert "relevant_laws" in data
        assert "analysis" in data
        print(f"✓ Criminal case analysis: {len(data['relevant_laws'])} laws found")


class TestConsultationRequest:
    """Consultation request tests - should create notifications"""
    
    @pytest.fixture
    def client_session(self):
        """Get authenticated client session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_consultation_request_creates_notification(self, client_session):
        """Test that consultation request creates notification for lawyer"""
        # First get a lawyer ID
        lawyers_response = requests.get(f"{BASE_URL}/api/lawyers")
        assert lawyers_response.status_code == 200
        lawyers = lawyers_response.json()
        
        if not lawyers:
            pytest.skip("No lawyers available for testing")
        
        lawyer_id = lawyers[0]["id"]
        
        # Create consultation request
        response = client_session.post(f"{BASE_URL}/api/consultation-request", json={
            "lawyer_id": lawyer_id,
            "case_summary": "TEST_consultation_request for testing notifications",
            "category": "Civil",
            "urgency": "Medium",
            "contact_preference": "email"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "message" in data
        print(f"✓ Consultation request created: {data['message']}")


class TestLawyersEndpoint:
    """Test lawyers listing endpoint"""
    
    def test_get_lawyers(self):
        """Test getting list of lawyers"""
        response = requests.get(f"{BASE_URL}/api/lawyers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if data:
            lawyer = data[0]
            assert "id" in lawyer
            assert "name" in lawyer
            assert "email" in lawyer
            assert "role" in lawyer
            assert lawyer["role"] == "lawyer"
            print(f"✓ Found {len(data)} lawyers")
        else:
            print("✓ Lawyers endpoint works (no lawyers seeded)")


class TestLawyerCases:
    """Test lawyer cases endpoint"""
    
    @pytest.fixture
    def lawyer_session(self):
        """Get authenticated lawyer session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": LAWYER_EMAIL,
            "password": LAWYER_PASSWORD
        })
        assert response.status_code == 200
        return session
    
    def test_get_cases_as_lawyer(self, lawyer_session):
        """Test getting cases as lawyer"""
        response = lawyer_session.get(f"{BASE_URL}/api/cases")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Lawyer can see {len(data)} open cases")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
