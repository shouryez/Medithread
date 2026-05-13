#!/usr/bin/env python3
"""
MediThread Backend API Test Suite
Tests all backend endpoints with cookie-based authentication
"""

import requests
import json
import re
import random
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://ebf946ec-168d-4a94-93e5-293f41b122e8.preview.emergentagent.com/api"

# Test data
test_phone = f"+9199990{random.randint(10000, 99999)}"  # Random Indian phone number
test_patient_data = {
    "full_name": "Rajesh Kumar Sharma",
    "dob": "1985-06-15",
    "gender": "male",
    "blood_group": "O+",
    "city": "Bangalore",
    "allergies": ["Penicillin", "Sulfa drugs"],
    "chronic_conditions": ["Type 2 Diabetes", "Hypertension"],
    "emergency_contact_name": "Priya Sharma",
    "emergency_contact_phone": "+919876543210"
}

# Global variables to store test data
dev_code = None
medi_id = None
consent_id = None
approved_consent_id = None
medication_id = None

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    print()

def test_health_check():
    """Test 1: Health check endpoints"""
    print("=" * 60)
    print("TEST 1: Health Check")
    print("=" * 60)
    
    try:
        # Test GET /api/
        resp = requests.get(f"{BASE_URL}/")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True and data.get("service") == "MediThread API"
        print_test("GET /api/", passed, f"Response: {data}")
        
        # Test GET /api/root
        resp = requests.get(f"{BASE_URL}/root")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("GET /api/root", passed, f"Response: {data}")
        
        return True
    except Exception as e:
        print_test("Health check", False, f"Error: {str(e)}")
        return False

def test_otp_flow(session):
    """Test 2: OTP send and verify flow"""
    global dev_code
    print("=" * 60)
    print("TEST 2: OTP Flow")
    print("=" * 60)
    
    try:
        # Test send OTP
        print(f"Testing with phone: {test_phone}")
        resp = session.post(f"{BASE_URL}/auth/send-otp", json={"phone": test_phone})
        data = resp.json()
        
        if resp.status_code == 200 and data.get("ok"):
            dev_code = data.get("_dev_code")
            print_test("POST /api/auth/send-otp", True, f"Dev code: {dev_code}, Channel: {data.get('channel')}")
        else:
            print_test("POST /api/auth/send-otp", False, f"Status: {resp.status_code}, Response: {data}")
            return False
        
        # Test verify OTP with correct code
        phone_without_plus = test_phone.replace("+91", "")
        resp = session.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone_without_plus, "code": dev_code})
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("ok") and data.get("hasPatient") == False and "userId" in data
        print_test("POST /api/auth/verify-otp (correct code)", passed, f"Response: {data}")
        
        if not passed:
            return False
        
        # Test GET /api/me (authenticated but no patient)
        resp = session.get(f"{BASE_URL}/me")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("authenticated") == True and data.get("patient") is None
        print_test("GET /api/me (no patient)", passed, f"Response: {data}")
        
        # Test negative: wrong OTP code
        new_session = requests.Session()
        resp2 = new_session.post(f"{BASE_URL}/auth/send-otp", json={"phone": f"+919999{random.randint(100000, 999999)}"})
        if resp2.status_code == 200:
            resp3 = new_session.post(f"{BASE_URL}/auth/verify-otp", json={"phone": "9999999999", "code": "000000"})
            passed = resp3.status_code == 400
            print_test("POST /api/auth/verify-otp (wrong code)", passed, f"Status: {resp3.status_code}")
        
        # Test negative: bad phone
        resp = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": ""})
        passed = resp.status_code == 400
        print_test("POST /api/auth/send-otp (bad phone)", passed, f"Status: {resp.status_code}")
        
        return True
    except Exception as e:
        print_test("OTP flow", False, f"Error: {str(e)}")
        return False

def test_patient_register(session):
    """Test 3: Patient registration"""
    global medi_id
    print("=" * 60)
    print("TEST 3: Patient Registration")
    print("=" * 60)
    
    try:
        # Test patient registration
        resp = session.post(f"{BASE_URL}/patient/register", json=test_patient_data)
        data = resp.json()
        
        if resp.status_code == 200 and data.get("ok"):
            patient = data.get("patient", {})
            medi_id = patient.get("medi_id")
            # Check MediID format: MT-YYYY-XXX-XXXXXXXX
            medi_id_pattern = r'^MT-\d{4}-[A-Z]{3}-\d{8}$'
            medi_id_valid = bool(re.match(medi_id_pattern, medi_id)) if medi_id else False
            print_test("POST /api/patient/register", medi_id_valid, f"MediID: {medi_id}")
            
            if not medi_id_valid:
                return False
        else:
            print_test("POST /api/patient/register", False, f"Status: {resp.status_code}, Response: {data}")
            return False
        
        # Test GET /api/me again (should have patient now)
        resp = session.get(f"{BASE_URL}/me")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("patient") is not None
        print_test("GET /api/me (with patient)", passed, f"Patient exists: {data.get('patient') is not None}")
        
        # Test negative: missing required fields
        resp = session.post(f"{BASE_URL}/patient/register", json={"full_name": "Test"})
        passed = resp.status_code == 400
        print_test("POST /api/patient/register (missing fields)", passed, f"Status: {resp.status_code}")
        
        # Test register again (should return existing patient)
        resp = session.post(f"{BASE_URL}/patient/register", json=test_patient_data)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("existed") == True
        print_test("POST /api/patient/register (duplicate)", passed, f"Existed: {data.get('existed')}")
        
        return True
    except Exception as e:
        print_test("Patient registration", False, f"Error: {str(e)}")
        return False

def test_dashboard(session):
    """Test 4: Dashboard stats"""
    print("=" * 60)
    print("TEST 4: Dashboard Stats")
    print("=" * 60)
    
    try:
        resp = session.get(f"{BASE_URL}/patient/dashboard")
        data = resp.json()
        
        if resp.status_code == 200:
            stats = data.get("stats", {})
            recent_visits = data.get("recentVisits", [])
            passed = "visits" in stats and "activeMeds" in stats and "reports" in stats and "pendingConsents" in stats
            print_test("GET /api/patient/dashboard", passed, 
                      f"Stats: visits={stats.get('visits')}, activeMeds={stats.get('activeMeds')}, "
                      f"reports={stats.get('reports')}, pendingConsents={stats.get('pendingConsents')}, "
                      f"recentVisits={len(recent_visits)}")
            return passed
        else:
            print_test("GET /api/patient/dashboard", False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_test("Dashboard", False, f"Error: {str(e)}")
        return False

def test_demo_seed(session):
    """Test 5: Demo seed endpoint"""
    print("=" * 60)
    print("TEST 5: Demo Seed")
    print("=" * 60)
    
    try:
        resp = session.post(f"{BASE_URL}/demo/seed")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("POST /api/demo/seed", passed, f"Response: {data}")
        
        if not passed:
            return False
        
        # Check dashboard again after seed
        resp = session.get(f"{BASE_URL}/patient/dashboard")
        data = resp.json()
        
        if resp.status_code == 200:
            stats = data.get("stats", {})
            recent_visits = data.get("recentVisits", [])
            
            # Check if stats are populated
            visits_ok = stats.get("visits", 0) == 2
            active_meds_ok = stats.get("activeMeds", 0) == 1
            reports_ok = stats.get("reports", 0) == 1
            pending_consents_ok = stats.get("pendingConsents", 0) == 1
            recent_visits_ok = len(recent_visits) == 2
            
            # Check if AI summary is present (may be null if Gemini quota issues)
            ai_summary_note = ""
            if recent_visits:
                has_ai_summary = any(v.get("ai_summary") for v in recent_visits)
                ai_summary_note = f"AI summaries present: {has_ai_summary}"
            
            passed = visits_ok and active_meds_ok and reports_ok and pending_consents_ok and recent_visits_ok
            print_test("GET /api/patient/dashboard (after seed)", passed,
                      f"Stats: visits={stats.get('visits')}, activeMeds={stats.get('activeMeds')}, "
                      f"reports={stats.get('reports')}, pendingConsents={stats.get('pendingConsents')}, "
                      f"recentVisits={len(recent_visits)}. {ai_summary_note}")
            return passed
        else:
            print_test("Dashboard after seed", False, f"Status: {resp.status_code}")
            return False
    except Exception as e:
        print_test("Demo seed", False, f"Error: {str(e)}")
        return False

def test_visits(session):
    """Test 6: Visits endpoints"""
    print("=" * 60)
    print("TEST 6: Visits")
    print("=" * 60)
    
    try:
        # Test GET /api/visits
        resp = session.get(f"{BASE_URL}/visits")
        data = resp.json()
        
        if resp.status_code == 200:
            visits = data.get("visits", [])
            passed = len(visits) == 2
            
            # Check if visits are hydrated
            if visits:
                first_visit = visits[0]
                has_hospital = first_visit.get("hospital") is not None
                has_prescriptions = "prescriptions" in first_visit
                has_reports = "reports" in first_visit
                print_test("GET /api/visits", passed,
                          f"Visits count: {len(visits)}, Hydrated: hospital={has_hospital}, "
                          f"prescriptions={has_prescriptions}, reports={has_reports}")
            else:
                print_test("GET /api/visits", False, "No visits found")
                return False
        else:
            print_test("GET /api/visits", False, f"Status: {resp.status_code}")
            return False
        
        # Test filter by year
        current_year = datetime.now().year
        resp = session.get(f"{BASE_URL}/visits?year={current_year}")
        data = resp.json()
        passed = resp.status_code == 200
        print_test(f"GET /api/visits?year={current_year}", passed, f"Visits: {len(data.get('visits', []))}")
        
        # Test filter by department
        resp = session.get(f"{BASE_URL}/visits?department=Endocrinology")
        data = resp.json()
        visits = data.get("visits", [])
        passed = resp.status_code == 200 and len(visits) >= 1
        print_test("GET /api/visits?department=Endocrinology", passed, f"Visits: {len(visits)}")
        
        return True
    except Exception as e:
        print_test("Visits", False, f"Error: {str(e)}")
        return False

def test_medications(session):
    """Test 7: Medications endpoints"""
    global medication_id
    print("=" * 60)
    print("TEST 7: Medications")
    print("=" * 60)
    
    try:
        # Test GET /api/medications
        resp = session.get(f"{BASE_URL}/medications")
        data = resp.json()
        
        if resp.status_code == 200:
            active = data.get("active", [])
            past = data.get("past", [])
            passed = len(active) == 1 and len(past) == 1
            print_test("GET /api/medications", passed, f"Active: {len(active)}, Past: {len(past)}")
        else:
            print_test("GET /api/medications", False, f"Status: {resp.status_code}")
            return False
        
        # Test POST /api/medications (create new medication)
        new_med = {
            "drug_name": "Aspirin 75mg",
            "dosage": "1 tablet",
            "frequency": "Once daily",
            "duration_days": 30,
            "start_date": datetime.now().isoformat()
        }
        resp = session.post(f"{BASE_URL}/medications", json=new_med)
        data = resp.json()
        
        if resp.status_code == 200 and data.get("ok"):
            medication_id = data.get("prescription", {}).get("id")
            print_test("POST /api/medications", True, f"Created medication ID: {medication_id}")
        else:
            print_test("POST /api/medications", False, f"Status: {resp.status_code}")
            return False
        
        # Test PUT /api/medications/:id (enable reminder)
        if medication_id:
            resp = session.put(f"{BASE_URL}/medications/{medication_id}", json={"reminder_enabled": True})
            data = resp.json()
            passed = resp.status_code == 200 and data.get("ok") == True
            print_test(f"PUT /api/medications/{medication_id} (enable reminder)", passed)
            
            # Test PUT /api/medications/:id (deactivate)
            resp = session.put(f"{BASE_URL}/medications/{medication_id}", json={"is_active": False})
            data = resp.json()
            passed = resp.status_code == 200 and data.get("ok") == True
            print_test(f"PUT /api/medications/{medication_id} (deactivate)", passed)
        
        return True
    except Exception as e:
        print_test("Medications", False, f"Error: {str(e)}")
        return False

def test_reports(session):
    """Test 8: Reports endpoints"""
    print("=" * 60)
    print("TEST 8: Reports")
    print("=" * 60)
    
    try:
        # Test GET /api/reports
        resp = session.get(f"{BASE_URL}/reports")
        data = resp.json()
        
        if resp.status_code == 200:
            reports = data.get("reports", [])
            passed = len(reports) == 1
            print_test("GET /api/reports", passed, f"Reports count: {len(reports)}")
        else:
            print_test("GET /api/reports", False, f"Status: {resp.status_code}")
            return False
        
        # Test GET /api/reports?type=lab
        resp = session.get(f"{BASE_URL}/reports?type=lab")
        data = resp.json()
        reports = data.get("reports", [])
        passed = resp.status_code == 200 and len(reports) == 1
        print_test("GET /api/reports?type=lab", passed, f"Lab reports: {len(reports)}")
        
        # Test GET /api/reports?type=xray
        resp = session.get(f"{BASE_URL}/reports?type=xray")
        data = resp.json()
        reports = data.get("reports", [])
        passed = resp.status_code == 200 and len(reports) == 0
        print_test("GET /api/reports?type=xray", passed, f"X-ray reports: {len(reports)}")
        
        # Test POST /api/reports (self upload)
        new_report = {
            "title": "Self upload - Blood Test",
            "report_type": "other",
            "report_date": "2025-01-01"
        }
        resp = session.post(f"{BASE_URL}/reports", json=new_report)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("POST /api/reports", passed, f"Created report ID: {data.get('report', {}).get('id')}")
        
        return True
    except Exception as e:
        print_test("Reports", False, f"Error: {str(e)}")
        return False

def test_consents(session):
    """Test 9: Consents endpoints"""
    global consent_id, approved_consent_id
    print("=" * 60)
    print("TEST 9: Consents")
    print("=" * 60)
    
    try:
        # Test GET /api/consents
        resp = session.get(f"{BASE_URL}/consents")
        data = resp.json()
        
        if resp.status_code == 200:
            pending = data.get("pending", [])
            active = data.get("active", [])
            audit = data.get("audit", [])
            passed = len(pending) == 1 and len(active) == 0 and len(audit) > 0
            print_test("GET /api/consents", passed,
                      f"Pending: {len(pending)}, Active: {len(active)}, Audit entries: {len(audit)}")
            
            if pending:
                consent_id = pending[0].get("id")
        else:
            print_test("GET /api/consents", False, f"Status: {resp.status_code}")
            return False
        
        # Test POST /api/consents/:id/approve
        if consent_id:
            resp = session.post(f"{BASE_URL}/consents/{consent_id}/approve")
            data = resp.json()
            passed = resp.status_code == 200 and data.get("ok") == True
            print_test(f"POST /api/consents/{consent_id}/approve", passed)
            approved_consent_id = consent_id
        
        # Test GET /api/consents again (should have 1 active now)
        resp = session.get(f"{BASE_URL}/consents")
        data = resp.json()
        
        if resp.status_code == 200:
            pending = data.get("pending", [])
            active = data.get("active", [])
            passed = len(active) == 1
            
            # Check if expires_at is set
            if active:
                expires_at = active[0].get("expires_at")
                print_test("GET /api/consents (after approve)", passed,
                          f"Active: {len(active)}, Expires at: {expires_at}")
        
        # Test POST /api/consents/:id/revoke
        if approved_consent_id:
            resp = session.post(f"{BASE_URL}/consents/{approved_consent_id}/revoke")
            data = resp.json()
            passed = resp.status_code == 200 and data.get("ok") == True
            print_test(f"POST /api/consents/{approved_consent_id}/revoke", passed)
        
        # Test POST /api/consents (create new demo consent)
        new_consent = {
            "hospital_name": "Test Hospital Bangalore"
        }
        resp = session.post(f"{BASE_URL}/consents", json=new_consent)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("POST /api/consents (create new)", passed, f"New consent ID: {data.get('consent', {}).get('id')}")
        
        return True
    except Exception as e:
        print_test("Consents", False, f"Error: {str(e)}")
        return False

def test_health_metrics(session):
    """Test 10: Health metrics endpoints"""
    print("=" * 60)
    print("TEST 10: Health Metrics")
    print("=" * 60)
    
    try:
        # Test GET /api/metrics?type=blood_sugar&range=1M
        resp = session.get(f"{BASE_URL}/metrics?type=blood_sugar&range=1M")
        data = resp.json()
        
        if resp.status_code == 200:
            metrics = data.get("metrics", [])
            passed = len(metrics) >= 11  # Should have ~11 from seed
            print_test("GET /api/metrics?type=blood_sugar&range=1M", passed, f"Metrics count: {len(metrics)}")
        else:
            print_test("GET /api/metrics", False, f"Status: {resp.status_code}")
            return False
        
        # Test POST /api/metrics (create new metric)
        new_metric = {
            "metric_type": "weight",
            "value": 70,
            "unit": "kg"
        }
        resp = session.post(f"{BASE_URL}/metrics", json=new_metric)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("POST /api/metrics", passed, f"Created metric ID: {data.get('metric', {}).get('id')}")
        
        # Test GET /api/metrics?type=weight
        resp = session.get(f"{BASE_URL}/metrics?type=weight")
        data = resp.json()
        
        if resp.status_code == 200:
            metrics = data.get("metrics", [])
            passed = len(metrics) == 1
            print_test("GET /api/metrics?type=weight", passed, f"Weight metrics: {len(metrics)}")
        
        return True
    except Exception as e:
        print_test("Health metrics", False, f"Error: {str(e)}")
        return False

def test_emergency_public():
    """Test 11: Emergency public lookup (no auth)"""
    print("=" * 60)
    print("TEST 11: Emergency Public Lookup")
    print("=" * 60)
    
    try:
        # Test GET /api/emergency/:mediId (no auth needed)
        if not medi_id:
            print_test("Emergency lookup", False, "No MediID available")
            return False
        
        # Use fresh session without cookies
        resp = requests.get(f"{BASE_URL}/emergency/{medi_id}")
        data = resp.json()
        
        if resp.status_code == 200:
            # Check required fields are present
            has_first_name = "first_name" in data
            has_blood_group = "blood_group" in data
            has_allergies = "allergies" in data
            has_chronic = "chronic_conditions" in data
            has_emergency_contact = "emergency_contact_name" in data and "emergency_contact_phone" in data
            
            # Check sensitive fields are NOT present
            no_phone = "phone" not in data
            no_full_dob = data.get("dob") is None or len(str(data.get("dob", ""))) == 0
            no_visits = "visits" not in data
            
            passed = (has_first_name and has_blood_group and has_allergies and has_chronic and 
                     has_emergency_contact and no_phone and no_full_dob and no_visits)
            
            print_test(f"GET /api/emergency/{medi_id}", passed,
                      f"Has required fields: {has_first_name and has_blood_group and has_allergies}, "
                      f"No sensitive data: {no_phone and no_full_dob and no_visits}")
        else:
            print_test("Emergency lookup", False, f"Status: {resp.status_code}")
            return False
        
        # Test GET /api/emergency/:mediId with invalid ID
        resp = requests.get(f"{BASE_URL}/emergency/MT-9999-XXX-99999999")
        passed = resp.status_code == 404
        print_test("GET /api/emergency/:mediId (invalid)", passed, f"Status: {resp.status_code}")
        
        return True
    except Exception as e:
        print_test("Emergency public lookup", False, f"Error: {str(e)}")
        return False

def test_logout(session):
    """Test 12: Logout"""
    print("=" * 60)
    print("TEST 12: Logout")
    print("=" * 60)
    
    try:
        # Test POST /api/auth/logout
        resp = session.post(f"{BASE_URL}/auth/logout")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("POST /api/auth/logout", passed)
        
        # Test GET /api/me (should be unauthenticated now)
        resp = session.get(f"{BASE_URL}/me")
        data = resp.json()
        passed = resp.status_code == 200 and data.get("authenticated") == False
        print_test("GET /api/me (after logout)", passed, f"Authenticated: {data.get('authenticated')}")
        
        return True
    except Exception as e:
        print_test("Logout", False, f"Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("MEDITHREAD BACKEND API TEST SUITE")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Phone: {test_phone}")
    print("=" * 60 + "\n")
    
    # Create session for authenticated requests
    session = requests.Session()
    
    # Run tests in order
    results = []
    
    results.append(("Health Check", test_health_check()))
    results.append(("OTP Flow", test_otp_flow(session)))
    results.append(("Patient Registration", test_patient_register(session)))
    results.append(("Dashboard", test_dashboard(session)))
    results.append(("Demo Seed", test_demo_seed(session)))
    results.append(("Visits", test_visits(session)))
    results.append(("Medications", test_medications(session)))
    results.append(("Reports", test_reports(session)))
    results.append(("Consents", test_consents(session)))
    results.append(("Health Metrics", test_health_metrics(session)))
    results.append(("Emergency Public", test_emergency_public()))
    results.append(("Logout", test_logout(session)))
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed_count = sum(1 for _, result in results if result)
    total_count = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print("=" * 60)
    print(f"Total: {passed_count}/{total_count} tests passed")
    print("=" * 60 + "\n")
    
    return passed_count == total_count

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
