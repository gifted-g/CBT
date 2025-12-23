/**
 * Simple test script to verify backend endpoints
 * Run with: node test-endpoints.js
 */

const BASE_URL = 'http://localhost:7071/api';

async function testContactForm() {
  console.log('🧪 Testing Contact Form...');
  
  const response = await fetch(`${BASE_URL}/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
      message: 'This is a test message from the contact form.'
    })
  });

  const result = await response.json();
  console.log('Contact Form Response:', result);
  return result.success;
}

async function testWaitlist() {
  console.log('🧪 Testing Waitlist...');
  
  const response = await fetch(`${BASE_URL}/waitlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'waitlist@example.com',
      name: 'Waitlist User'
    })
  });

  const result = await response.json();
  console.log('Waitlist Response:', result);
  return result.success;
}

async function testAdmin() {
  console.log('🧪 Testing Admin Dashboard...');
  
  // Test without auth (should fail)
  const response1 = await fetch(`${BASE_URL}/admin?action=stats`);
  const result1 = await response1.json();
  console.log('Admin (no auth):', result1);

  // Test with auth (replace with your actual admin key)
  const response2 = await fetch(`${BASE_URL}/admin?action=stats`, {
    headers: {
      'Authorization': 'Bearer your-admin-key-here'
    }
  });
  const result2 = await response2.json();
  console.log('Admin (with auth):', result2);
}

async function runTests() {
  console.log('🚀 Starting Backend Tests...\n');
  
  try {
    await testContactForm();
    console.log('');
    
    await testWaitlist();
    console.log('');
    
    await testAdmin();
    console.log('');
    
    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if running directly
if (require.main === module) {
  runTests();
}