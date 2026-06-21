"""
VakilSetu Intelligence Engine API Tests
Tests for: keyword extraction, decision tree questions, case analysis, 
risk analysis, NyayID generation, stamp paper diagnostic, consultation,
affidavit generation, translation, and case saving.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_API_URL', 'https://legal-match-10.preview.emergentagent.com')

# Test credentials
TEST_CLIENT_EMAIL = "client@test.com"
TEST_CLIENT_PASSWORD = "password123"
TEST_LAWYER_EMAIL = "lawyer@test.com"
TEST_LAWYER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def client_session():
    """Create authenticated client session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as client
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_CLIENT_EMAIL,
        "password": TEST_CLIENT_PASSWORD
    })
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return session


@pytest.fixture(scope="module")
def lawyer_session():
    """Create authenticated lawyer session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as lawyer
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_LAWYER_EMAIL,
        "password": TEST_LAWYER_PASSWORD
    })
    assert response.status_code == 200, f"Lawyer login failed: {response.text}"
    return session


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_client_login_success(self):
        """Test client login with valid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CLIENT_EMAIL,
            "password": TEST_CLIENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_CLIENT_EMAIL
        assert data["role"] == "client"
        assert "id" in data
    
    def test_lawyer_login_success(self):
        """Test lawyer login with valid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_LAWYER_EMAIL,
            "password": TEST_LAWYER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_LAWYER_EMAIL
        assert data["role"] == "lawyer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestKeywordExtraction:
    """Keyword extraction endpoint tests"""
    
    def test_extract_keywords_success(self):
        """Test keyword extraction from legal text"""
        response = requests.post(f"{BASE_URL}/api/extract-keywords", json={
            "text": "My landlord is refusing to return my security deposit of Rs.50000 after I vacated the flat"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "keywords" in data
        assert "suggested_category" in data
        assert "confidence" in data
        assert "reasoning" in data
        
        # Verify data types
        assert isinstance(data["keywords"], list)
        assert len(data["keywords"]) > 0
        assert isinstance(data["confidence"], (int, float))
        assert data["confidence"] >= 0 and data["confidence"] <= 100
    
    def test_extract_keywords_criminal_case(self):
        """Test keyword extraction for criminal case"""
        response = requests.post(f"{BASE_URL}/api/extract-keywords", json={
            "text": "I was assaulted by my neighbor and suffered injuries. I want to file an FIR."
        })
        assert response.status_code == 200
        data = response.json()
        assert "suggested_category" in data
        # Category should be Criminal or related
        assert data["suggested_category"] in ["Criminal", "Civil", "Family", "Property", "Employment"]


class TestDecisionTreeQuestions:
    """Decision tree questions endpoint tests"""
    
    def test_get_first_question_civil(self):
        """Test getting first question for Civil category"""
        response = requests.post(f"{BASE_URL}/api/get-questions", json={
            "category": "Civil",
            "question_id": None,
            "previous_answers": {}
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "question" in data
        assert "has_more" in data
        assert data["question"] is not None
        assert data["question"]["id"] == "q1"
        assert data["question"]["type"] == "mcq"
        assert "options" in data["question"]
    
    def test_get_first_question_criminal(self):
        """Test getting first question for Criminal category"""
        response = requests.post(f"{BASE_URL}/api/get-questions", json={
            "category": "Criminal",
            "question_id": None,
            "previous_answers": {}
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["question"]["id"] == "q1"
        assert data["question"]["type"] == "yes_no"
        assert "Has an FIR been filed?" in data["question"]["text"]
    
    def test_get_follow_up_question(self):
        """Test getting follow-up question based on answer"""
        response = requests.post(f"{BASE_URL}/api/get-questions", json={
            "category": "Civil",
            "question_id": "q1",
            "previous_answers": {"q1": "Money recovery"}
        })
        assert response.status_code == 200
        data = response.json()
        
        # Should get q4 based on decision tree
        assert data["question"]["id"] == "q4"
    
    def test_all_categories_have_questions(self):
        """Test that all categories return questions"""
        categories = ["Criminal", "Civil", "Family", "Property", "Employment"]
        
        for category in categories:
            response = requests.post(f"{BASE_URL}/api/get-questions", json={
                "category": category,
                "question_id": None,
                "previous_answers": {}
            })
            assert response.status_code == 200, f"Failed for category: {category}"
            data = response.json()
            assert data["question"] is not None, f"No question for category: {category}"


class TestCaseAnalysis:
    """Case analysis endpoint tests"""
    
    def test_analyze_case_success(self):
        """Test case analysis with valid data"""
        response = requests.post(f"{BASE_URL}/api/analyze-case", json={
            "case_type": "Civil",
            "description": "My landlord is refusing to return my security deposit of Rs.50000",
            "location": "Mumbai",
            "urgency": "Medium"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "relevant_laws" in data
        assert "similar_cases" in data
        assert "analysis" in data
        assert "case_summary" in data
        assert "matched_lawyers" in data
        
        # Verify data types
        assert isinstance(data["relevant_laws"], list)
        assert isinstance(data["similar_cases"], list)
        assert isinstance(data["analysis"], str)
        assert len(data["analysis"]) > 0
    
    def test_analyze_case_returns_lawyers(self):
        """Test that case analysis returns matched lawyers"""
        response = requests.post(f"{BASE_URL}/api/analyze-case", json={
            "case_type": "Criminal",
            "description": "I was assaulted and want to file a case",
            "location": "Mumbai",
            "urgency": "High"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "matched_lawyers" in data
        if len(data["matched_lawyers"]) > 0:
            lawyer = data["matched_lawyers"][0]
            assert "id" in lawyer
            assert "name" in lawyer
            assert "match_score" in lawyer


class TestRiskAnalysis:
    """Risk analysis endpoint tests"""
    
    def test_risk_analysis_success(self):
        """Test risk analysis with valid data"""
        response = requests.post(f"{BASE_URL}/api/risk-analysis", json={
            "category": "Civil",
            "answers": {"q1": "Money recovery", "q4": "yes", "q6": "no"},
            "description": "Security deposit dispute with landlord"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success_probability" in data
        assert "case_strength" in data
        assert "risk_level" in data
        assert "level" in data
        assert "estimated_duration" in data
        assert "estimated_cost" in data
        assert "insights" in data
        
        # Verify data values
        assert data["success_probability"] >= 30 and data["success_probability"] <= 95
        assert data["case_strength"] in ["Strong", "Moderate", "Weak"]
        assert data["risk_level"] in ["Low", "Medium", "High"]
        assert data["level"] in ["Basic", "Moderate", "Complex"]


class TestStampPaperDiagnostic:
    """Stamp paper diagnostic endpoint tests"""
    
    def test_judicial_stamp_paper(self):
        """Test diagnostic for judicial stamp paper"""
        response = requests.post(f"{BASE_URL}/api/stamp-paper-diagnostic", json={
            "is_court_case": True,
            "is_court_fee": False,
            "is_agreement": False,
            "is_affidavit": False,
            "is_petition": False
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["stamp_paper_type"] == "Judicial Stamp Paper"
        assert "reasoning" in data
    
    def test_non_judicial_stamp_paper(self):
        """Test diagnostic for non-judicial stamp paper"""
        response = requests.post(f"{BASE_URL}/api/stamp-paper-diagnostic", json={
            "is_court_case": False,
            "is_court_fee": False,
            "is_agreement": True,
            "is_affidavit": False,
            "is_petition": False
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["stamp_paper_type"] == "Non-Judicial Stamp Paper"


class TestNyayIDGeneration:
    """NyayID generation endpoint tests"""
    
    def test_generate_nyayid_success(self):
        """Test NyayID generation"""
        response = requests.post(f"{BASE_URL}/api/generate-nyayid", json={
            "case_data": {
                "category": "Civil",
                "description": "Security deposit dispute",
                "location": "Mumbai",
                "urgency": "Medium"
            },
            "analysis_result": {},
            "answers": {"q1": "Money recovery"}
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "nyay_id" in data
        assert "generated_at" in data
        assert "case_summary" in data
        assert "risk_assessment" in data
        assert "complexity" in data
        assert "next_steps" in data
        assert "disclaimer" in data
        
        # Verify NyayID format
        assert data["nyay_id"].startswith("NYAY-")
        assert len(data["nyay_id"]) > 10


class TestTranslation:
    """Translation endpoint tests"""
    
    def test_translate_to_hindi(self):
        """Test translation to Hindi"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "This is a legal document",
            "target_language": "Hindi"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "original_text" in data
        assert "translated_text" in data
        assert "target_language" in data
        assert data["target_language"] == "Hindi"
        assert data["translated_text"] != data["original_text"]
    
    def test_translate_unsupported_language(self):
        """Test translation with unsupported language"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "This is a legal document",
            "target_language": "French"
        })
        assert response.status_code == 400


class TestAuthenticatedEndpoints:
    """Tests for endpoints requiring authentication"""
    
    def test_my_cases_success(self, client_session):
        """Test getting client's cases"""
        response = client_session.get(f"{BASE_URL}/api/my-cases")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            case = data[0]
            assert "id" in case
            assert "case_type" in case
            assert "description" in case
            assert "status" in case
    
    def test_my_cases_unauthorized(self):
        """Test my-cases without auth"""
        response = requests.get(f"{BASE_URL}/api/my-cases")
        assert response.status_code == 401
    
    def test_consultation_request_success(self, client_session):
        """Test creating consultation request"""
        # First get a lawyer ID
        lawyers_response = requests.get(f"{BASE_URL}/api/lawyers")
        assert lawyers_response.status_code == 200
        lawyers = lawyers_response.json()
        
        if len(lawyers) > 0:
            lawyer_id = lawyers[0]["id"]
            
            response = client_session.post(f"{BASE_URL}/api/consultation-request", json={
                "lawyer_id": lawyer_id,
                "case_summary": "Test consultation request",
                "category": "Civil",
                "urgency": "Medium",
                "contact_preference": "email"
            })
            assert response.status_code == 200
            data = response.json()
            
            assert "id" in data
            assert "message" in data
            assert data["status"] == "pending"
    
    def test_save_case_with_nyayid_success(self, client_session):
        """Test saving case with NyayID"""
        response = client_session.post(f"{BASE_URL}/api/save-case-with-nyayid", json={
            "category": "Civil",
            "description": "TEST_Automated test case for NyayID saving",
            "location": "Mumbai",
            "urgency": "Medium",
            "nyay_id": f"NYAY-TEST-{int(time.time())}",
            "analysis_summary": "Test analysis summary",
            "risk_level": "Medium",
            "complexity": "Basic"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "nyay_id" in data
        assert "message" in data
    
    def test_generate_affidavit_success(self, client_session):
        """Test affidavit generation"""
        response = client_session.post(f"{BASE_URL}/api/generate-affidavit", json={
            "affiant_name": "Test User",
            "affiant_address": "123 Test Street, Mumbai",
            "purpose": "Name change",
            "facts": ["I am a citizen of India", "I wish to change my name"],
            "court_name": "",
            "case_number": ""
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "affidavit_text" in data
        assert "generated_at" in data
        assert "affiant_name" in data
        assert len(data["affidavit_text"]) > 100
    
    def test_generate_affidavit_unauthorized(self):
        """Test affidavit generation without auth"""
        response = requests.post(f"{BASE_URL}/api/generate-affidavit", json={
            "affiant_name": "Test User",
            "affiant_address": "123 Test Street",
            "purpose": "Test",
            "facts": ["Test fact"]
        })
        assert response.status_code == 401


class TestLawyerEndpoints:
    """Tests for lawyer-specific endpoints"""
    
    def test_get_cases_as_lawyer(self, lawyer_session):
        """Test getting cases as lawyer"""
        response = lawyer_session.get(f"{BASE_URL}/api/cases")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    def test_get_cases_as_client_forbidden(self, client_session):
        """Test that clients cannot access lawyer cases endpoint"""
        response = client_session.get(f"{BASE_URL}/api/cases")
        assert response.status_code == 403


class TestLawyersEndpoint:
    """Tests for lawyers listing endpoint"""
    
    def test_get_lawyers_success(self):
        """Test getting list of lawyers"""
        response = requests.get(f"{BASE_URL}/api/lawyers")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            lawyer = data[0]
            assert "id" in lawyer
            assert "name" in lawyer
            assert "email" in lawyer
            assert "role" in lawyer
            assert lawyer["role"] == "lawyer"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
