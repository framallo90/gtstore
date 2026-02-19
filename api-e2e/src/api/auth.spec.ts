import axios from 'axios';

function uniqueEmail(prefix: string) {
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

describe('Auth (e2e)', () => {
  it('registers and can login (sets refresh cookie)', async () => {
    const email = uniqueEmail('e2e');
    const password = 'password123';

    const registerRes = await axios.post(
      '/api/auth/register',
      {
        email,
        password,
        firstName: 'E2E',
        lastName: 'Test',
      },
      { validateStatus: () => true },
    );

    expect(registerRes.status).toBe(201);
    expect(registerRes.data).toHaveProperty('accessToken');
    expect(registerRes.data).toHaveProperty('user.email', email.toLowerCase());

    const setCookie = registerRes.headers['set-cookie'];
    expect(Array.isArray(setCookie)).toBe(true);
    expect((setCookie ?? []).join(';')).toContain('refreshToken=');

    const loginRes = await axios.post(
      '/api/auth/login',
      { email, password },
      { validateStatus: () => true },
    );

    expect(loginRes.status).toBe(201);
    expect(loginRes.data).toHaveProperty('accessToken');
    expect(loginRes.data).toHaveProperty('user.email', email.toLowerCase());
  });

  it('rejects invalid credentials', async () => {
    const res = await axios.post(
      '/api/auth/login',
      { email: uniqueEmail('missing'), password: 'password123' },
      { validateStatus: () => true },
    );

    expect(res.status).toBe(401);
    expect(res.data).toHaveProperty('message');
  });
});

