import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Metrik kustom
const errorRate = new Rate('errors');

// Konfigurasi test
export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Ramp up ke 50 user
    { duration: '3m', target: 50 }, // Stay di 50 user
    { duration: '1m', target: 0 },  // Ramp down ke 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% request harus selesai dalam 500ms
    errors: ['rate<0.1'],             // Error rate harus < 10%
  },
};

// Fungsi setup (opsional)
export function setup() {
  const loginRes = http.post('http://localhost:3000/api/auth/login', {
    phone: '6281234567890',
    password: 'test123'
  });
  return { token: loginRes.json('token') };
}

// Skenario test utama
export default function(data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test endpoint messages
  const messageRes = http.post('http://localhost:3000/api/messages/send', {
    to: '6281234567890',
    message: 'Test message'
  }, params);

  check(messageRes, {
    'status is 200': (r) => r.status === 200,
    'message sent successfully': (r) => r.json('success') === true,
  }) || errorRate.add(1);

  // Test endpoint status
  const statusRes = http.get('http://localhost:3000/api/status', params);
  
  check(statusRes, {
    'status is 200': (r) => r.status === 200,
    'bot is connected': (r) => r.json('connected') === true,
  }) || errorRate.add(1);

  sleep(1);
} 