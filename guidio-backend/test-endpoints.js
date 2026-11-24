const BASE_URL = "http://localhost:5000";

async function testEndpoints() {
  console.log("\n=== TESTING PUBLIC ENDPOINTS ===\n");

  // Test health (should work)
  console.log("1️⃣  Testing GET /api/health (PUBLIC)");
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    console.log("   Status:", res.status);
    console.log("   Response:", await res.json());
  } catch (e) {
    console.log("   ERROR:", e.message);
  }

  console.log("\n=== TESTING PROTECTED ENDPOINTS (NO TOKEN) ===\n");

  // Test protected endpoint without token (should return 401)
  console.log("2️⃣  Testing GET /api/users/me (NO TOKEN - should be 401)");
  try {
    const res = await fetch(`${BASE_URL}/api/users/me`);
    console.log("   Status:", res.status, "← Should be 401");
    const data = await res.json();
    console.log("   Response:", data);
    
    if (res.status === 401) {
      console.log("   ✅ CORRECT!");
    } else {
      console.log("   ❌ WRONG! Should be 401");
    }
  } catch (e) {
    console.log("   ERROR:", e.message);
  }
}

testEndpoints();