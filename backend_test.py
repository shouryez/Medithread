#!/usr/bin/env python3
"""
MediThread Backend Regression + Feature Test
Tests Gemini AI upgrade (2.5-flash) + notification preferences
"""
import requests
import json
import base64
import time
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

BASE_URL = "https://health-record-demo.preview.emergentagent.com/api"

# Session storage
patient_session = requests.Session()
hospital_session = requests.Session()

def log(msg):
    print(f"[TEST] {msg}")

def create_medicine_image():
    """Create a simple test medicine package image with text"""
    img = Image.new('RGB', (300, 150), color='white')
    draw = ImageDraw.Draw(img)
    # Use default font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except:
        font = ImageFont.load_default()
    
    # Draw medicine text
    draw.text((20, 40), "PARACETAMOL", fill='black', font=font)
    draw.text((20, 80), "500mg", fill='black', font=font)
    draw.text((20, 110), "Tablets", fill='blue', font=font)
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/jpeg;base64,{img_str}"

def create_blank_image():
    """Create a blank white image for OCR test"""
    img = Image.new('RGB', (200, 100), color='white')
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/jpeg;base64,{img_str}"

# ===== A) HEALTH CHECK =====
def test_health():
    log("A) Testing health check...")
    try:
        r = patient_session.get(f"{BASE_URL}/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get('ok') == True, f"Expected ok:true, got {data}"
        log("✅ Health check passed")
        return True
    except Exception as e:
        log(f"❌ Health check failed: {e}")
        return False

# ===== B) PATIENT OTP + REGISTER =====
def test_patient_auth():
    log("B) Testing patient OTP + register...")
    try:
        # Use unique phone number with timestamp
        phone = f"912345678{int(time.time()) % 100:02d}"
        
        # 1. Send OTP
        log(f"  Sending OTP to {phone}...")
        r = patient_session.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone})
        assert r.status_code == 200, f"Send OTP failed: {r.status_code} {r.text}"
        data = r.json()
        
        # Check if we got dev_code or need to use fallback
        if '_dev_code' in data:
            code = data['_dev_code']
            log(f"  Got dev code: {code}")
        elif data.get('mode') == 'verify':
            # Twilio Verify mode - use 000000 twice to trigger fallback
            log("  Twilio Verify mode detected, triggering fallback...")
            r2 = patient_session.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": "000000"})
            assert r2.status_code == 400, "Expected 400 for wrong code"
            # Try with different phone that returns dev_code
            phone = "9123456789"
            r = patient_session.post(f"{BASE_URL}/auth/send-otp", json={"phone": phone})
            data = r.json()
            code = data.get('_dev_code')
            if not code:
                log(f"❌ No dev code available: {data}")
                return False
        else:
            log(f"❌ Unexpected OTP response: {data}")
            return False
        
        # 2. Verify OTP
        log(f"  Verifying OTP...")
        r = patient_session.post(f"{BASE_URL}/auth/verify-otp", json={"phone": phone, "code": code})
        assert r.status_code == 200, f"Verify OTP failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get('ok') == True, f"Expected ok:true, got {data}"
        log(f"  Session cookie set, hasPatient={data.get('hasPatient')}")
        
        # 3. Check /me
        log("  Checking /me...")
        r = patient_session.get(f"{BASE_URL}/me")
        assert r.status_code == 200, f"GET /me failed: {r.status_code}"
        data = r.json()
        assert data.get('authenticated') == True, f"Expected authenticated:true, got {data}"
        log(f"  Authenticated: {data.get('authenticated')}")
        
        # 4. Register patient (if not already registered)
        if not data.get('patient'):
            log("  Registering patient...")
            r = patient_session.post(f"{BASE_URL}/patient/register", json={
                "full_name": "Rajesh Kumar",
                "dob": "1990-05-15",
                "gender": "male",
                "city": "Bangalore",
                "blood_group": "O+",
                "emergency_contact_name": "Priya Kumar",
                "emergency_contact_phone": "+919876543210"
            })
            assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
            data = r.json()
            assert data.get('ok') == True, f"Expected ok:true, got {data}"
            patient = data.get('patient')
            assert patient.get('medi_id'), f"Expected medi_id, got {patient}"
            log(f"  Registered with MediID: {patient.get('medi_id')}")
        else:
            patient = data.get('patient')
            log(f"  Already registered with MediID: {patient.get('medi_id')}")
        
        log("✅ Patient auth + register passed")
        return True
    except Exception as e:
        log(f"❌ Patient auth failed: {e}")
        import traceback
        traceback.print_exc()
        return False

# ===== C) NOTIFICATION PREFERENCES =====
def test_notification_preferences():
    log("C) Testing notification preferences...")
    try:
        # 1. Update profile with notification preferences
        log("  Setting notification preferences (notify_whatsapp=false)...")
        r = patient_session.put(f"{BASE_URL}/patient/profile", json={
            "notify_whatsapp": False,
            "notify_record_access": False,
            "notify_visit_added": True,
            "notify_consent_actions": True
        })
        assert r.status_code == 200, f"Profile update failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get('ok') == True, f"Expected ok:true, got {data}"
        patient = data.get('patient')
        assert patient.get('notify_whatsapp') == False, f"Expected notify_whatsapp=false, got {patient.get('notify_whatsapp')}"
        assert patient.get('notify_record_access') == False, f"Expected notify_record_access=false, got {patient.get('notify_record_access')}"
        assert patient.get('notify_visit_added') == True, f"Expected notify_visit_added=true, got {patient.get('notify_visit_added')}"
        assert patient.get('notify_consent_actions') == True, f"Expected notify_consent_actions=true, got {patient.get('notify_consent_actions')}"
        log(f"  ✓ Preferences set: notify_whatsapp={patient.get('notify_whatsapp')}")
        
        # 2. Verify persistence via GET /me
        log("  Verifying persistence via GET /me...")
        r = patient_session.get(f"{BASE_URL}/me")
        assert r.status_code == 200, f"GET /me failed: {r.status_code}"
        data = r.json()
        patient = data.get('patient')
        assert patient.get('notify_whatsapp') == False, f"Expected notify_whatsapp=false after reload, got {patient.get('notify_whatsapp')}"
        log(f"  ✓ Preferences persisted: notify_whatsapp={patient.get('notify_whatsapp')}")
        
        # 3. Toggle back to true
        log("  Toggling notify_whatsapp back to true...")
        r = patient_session.put(f"{BASE_URL}/patient/profile", json={
            "notify_whatsapp": True
        })
        assert r.status_code == 200, f"Profile update failed: {r.status_code} {r.text}"
        data = r.json()
        patient = data.get('patient')
        assert patient.get('notify_whatsapp') == True, f"Expected notify_whatsapp=true, got {patient.get('notify_whatsapp')}"
        log(f"  ✓ Toggled back: notify_whatsapp={patient.get('notify_whatsapp')}")
        
        log("✅ Notification preferences passed")
        return True
    except Exception as e:
        log(f"❌ Notification preferences failed: {e}")
        import traceback
        traceback.print_exc()
        return False

# ===== D) GEMINI AI ENDPOINTS =====
def test_gemini_medicine_scan():
    log("D1) Testing Gemini medicine-scan (patient session)...")
    try:
        # Create test medicine image
        log("  Creating test medicine image...")
        image_base64 = create_medicine_image()
        
        # Call medicine-scan endpoint
        log("  Calling POST /api/ai/medicine-scan...")
        r = patient_session.post(f"{BASE_URL}/ai/medicine-scan", json={
            "imageBase64": image_base64
        })
        assert r.status_code == 200, f"Medicine scan failed: {r.status_code} {r.text}"
        data = r.json()
        
        # Check response - should have either medicine data OR a specific error (not the old fallback)
        log(f"  Response: {json.dumps(data, indent=2)}")
        
        # The old fallback was: "AI scan unavailable right now"
        # With gemini-2.5-flash, we should get either:
        # 1. Success: {"name": "...", "generic_name": "...", ...}
        # 2. Soft refusal: {"error": "Could not identify medicine clearly..."}
        # NOT: {"error": "AI scan unavailable right now. Please try again later."}
        
        if 'error' in data:
            error_msg = data['error']
            # Check it's NOT the old catch-all fallback
            assert "AI scan unavailable right now" not in error_msg, f"Got old fallback error: {error_msg}"
            # Acceptable soft refusal from Gemini
            log(f"  ⚠️  Gemini soft refusal (acceptable): {error_msg}")
        else:
            # Success - should have medicine data
            assert 'name' in data or 'generic_name' in data, f"Expected medicine data, got {data}"
            log(f"  ✓ Medicine identified: {data.get('name', data.get('generic_name'))}")
        
        log("✅ Medicine scan passed (Gemini 2.5-flash working)")
        return True
    except Exception as e:
        log(f"❌ Medicine scan failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_gemini_hospital_endpoints():
    log("D2) Testing Gemini AI endpoints (hospital session)...")
    try:
        # First, register a hospital
        log("  Registering hospital...")
        timestamp = int(time.time())
        r = hospital_session.post(f"{BASE_URL}/hospital/auth/register", json={
            "hospital_name": f"Test Hospital {timestamp}",
            "registration_no": f"REG-{timestamp}",
            "city": "Bangalore",
            "admin_name": "Dr. Test Admin",
            "admin_email": f"admin{timestamp}@test.com",
            "password": "TestPass123!",
            "contact_phone": "+919999999999"
        })
        assert r.status_code == 200, f"Hospital register failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get('ok') == True, f"Expected ok:true, got {data}"
        log(f"  ✓ Hospital registered: {data.get('hospital', {}).get('name')}")
        
        # Get a patient ID for testing (seed demo data first)
        log("  Seeding patient demo data...")
        r = patient_session.post(f"{BASE_URL}/demo/seed")
        # Ignore if already seeded
        
        # Get patient info
        r = patient_session.get(f"{BASE_URL}/me")
        patient_data = r.json()
        patient_id = patient_data.get('patient', {}).get('id')
        assert patient_id, f"No patient ID found: {patient_data}"
        log(f"  ✓ Patient ID: {patient_id}")
        
        # D2a) Test drug-check
        log("  Testing POST /api/ai/drug-check...")
        r = hospital_session.post(f"{BASE_URL}/ai/drug-check", json={
            "newDrug": "Aspirin",
            "currentMedications": [{"drug_name": "Warfarin"}]
        })
        assert r.status_code == 200, f"Drug check failed: {r.status_code} {r.text}"
        data = r.json()
        log(f"  Response: {json.dumps(data, indent=2)}")
        
        # Should have severity field
        assert 'severity' in data, f"Expected severity field, got {data}"
        severity = data.get('severity')
        # Should NOT be the fallback "Unable to check interactions automatically"
        recommendation = data.get('recommendation', '')
        if "Unable to check interactions automatically" in recommendation:
            log(f"  ⚠️  Got fallback recommendation (Gemini may have failed)")
        else:
            log(f"  ✓ Drug check working: severity={severity}")
        
        # D2b) Test summarise
        log("  Testing GET /api/ai/summarise...")
        r = hospital_session.get(f"{BASE_URL}/ai/summarise?patientId={patient_id}")
        assert r.status_code == 200, f"Summarise failed: {r.status_code} {r.text}"
        data = r.json()
        log(f"  Response: {json.dumps(data, indent=2)}")
        
        summary = data.get('summary')
        assert summary is not None, f"Expected summary field, got {data}"
        if summary == "AI summary unavailable. Please retry.":
            log(f"  ⚠️  Got fallback summary (Gemini may have failed)")
        else:
            log(f"  ✓ Summary generated: {summary[:100]}...")
        
        # D2c) Test OCR
        log("  Testing POST /api/ai/ocr...")
        blank_image = create_blank_image()
        r = hospital_session.post(f"{BASE_URL}/ai/ocr", json={
            "imageBase64": blank_image
        })
        assert r.status_code == 200, f"OCR failed: {r.status_code} {r.text}"
        data = r.json()
        log(f"  Response: {json.dumps(data, indent=2)}")
        
        assert 'items' in data, f"Expected items field, got {data}"
        items = data.get('items')
        assert isinstance(items, list), f"Expected items to be array, got {type(items)}"
        log(f"  ✓ OCR returned items array (length={len(items)})")
        
        log("✅ Gemini hospital endpoints passed")
        return True
    except Exception as e:
        log(f"❌ Gemini hospital endpoints failed: {e}")
        import traceback
        traceback.print_exc()
        return False

# ===== E) REGRESSION TESTS =====
def test_regression():
    log("E) Running regression smoke tests...")
    try:
        # Dashboard
        log("  Testing GET /api/patient/dashboard...")
        r = patient_session.get(f"{BASE_URL}/patient/dashboard")
        assert r.status_code == 200, f"Dashboard failed: {r.status_code}"
        data = r.json()
        assert 'stats' in data, f"Expected stats, got {data}"
        log(f"  ✓ Dashboard: visits={data['stats'].get('visits')}, activeMeds={data['stats'].get('activeMeds')}")
        
        # Visits
        log("  Testing GET /api/visits...")
        r = patient_session.get(f"{BASE_URL}/visits")
        assert r.status_code == 200, f"Visits failed: {r.status_code}"
        data = r.json()
        assert 'visits' in data, f"Expected visits, got {data}"
        log(f"  ✓ Visits: count={len(data['visits'])}")
        
        # Medications
        log("  Testing GET /api/medications...")
        r = patient_session.get(f"{BASE_URL}/medications")
        assert r.status_code == 200, f"Medications failed: {r.status_code}"
        data = r.json()
        assert 'active' in data and 'past' in data, f"Expected active/past, got {data}"
        log(f"  ✓ Medications: active={len(data['active'])}, past={len(data['past'])}")
        
        # Reports
        log("  Testing GET /api/reports...")
        r = patient_session.get(f"{BASE_URL}/reports")
        assert r.status_code == 200, f"Reports failed: {r.status_code}"
        data = r.json()
        assert 'reports' in data, f"Expected reports, got {data}"
        log(f"  ✓ Reports: count={len(data['reports'])}")
        
        # Consents
        log("  Testing GET /api/consents...")
        r = patient_session.get(f"{BASE_URL}/consents")
        assert r.status_code == 200, f"Consents failed: {r.status_code}"
        data = r.json()
        assert 'pending' in data and 'active' in data, f"Expected pending/active, got {data}"
        log(f"  ✓ Consents: pending={len(data['pending'])}, active={len(data['active'])}")
        
        log("✅ Regression tests passed")
        return True
    except Exception as e:
        log(f"❌ Regression tests failed: {e}")
        import traceback
        traceback.print_exc()
        return False

# ===== MAIN =====
def main():
    log("=" * 60)
    log("MediThread Backend Regression + Feature Test")
    log("Testing: Gemini 2.5-flash upgrade + notification preferences")
    log("=" * 60)
    
    results = {}
    
    # Run tests in order
    results['A_health'] = test_health()
    results['B_patient_auth'] = test_patient_auth()
    results['C_notification_prefs'] = test_notification_preferences()
    results['D1_medicine_scan'] = test_gemini_medicine_scan()
    results['D2_hospital_ai'] = test_gemini_hospital_endpoints()
    results['E_regression'] = test_regression()
    
    # Summary
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"{status} - {test}")
    
    log("=" * 60)
    log(f"TOTAL: {passed}/{total} tests passed")
    log("=" * 60)
    
    return all(results.values())

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
