#!/bin/bash

echo "🧪 Testing Backend After Database Setup"
echo "======================================"

echo ""
echo "1. Testing Customers API..."
curl -s https://carwash-backend-5spn.onrender.com/api/customers | python3 -m json.tool

echo ""
echo "2. Testing Wash Types API..."
curl -s https://carwash-backend-5spn.onrender.com/api/wash-types | python3 -m json.tool

echo ""
echo "3. Testing Health Check..."
curl -s https://carwash-backend-5spn.onrender.com/health | python3 -m json.tool

echo ""
echo "4. Creating Test Customer..."
curl -X POST https://carwash-backend-5spn.onrender.com/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john.doe@example.com","membershipStatus":"active"}' \
  | python3 -m json.tool

echo ""
echo "5. Creating Test Wash Type..."
curl -X POST https://carwash-backend-5spn.onrender.com/api/wash-types \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wash","description":"Test wash type","duration":300,"price":9.99,"relayId":2,"isActive":true}' \
  | python3 -m json.tool

echo ""
echo "✅ Testing Complete!"
echo "If you see JSON responses (not error messages), your backend is working!" 