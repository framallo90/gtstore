import axios from 'axios';

describe('Marketplace API', () => {
  it('GET /api/marketplace/listings should respond with a public list', async () => {
    const res = await axios.get('/api/marketplace/listings');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('POST /api/marketplace/orders/quote should require auth', async () => {
    try {
      await axios.post('/api/marketplace/orders/quote', {
        listingId: 'test',
        shippingCity: 'Rosario',
        shippingPostalCode: '2000',
      });
      throw new Error('Expected request to fail');
    } catch (error: any) {
      expect(error?.response?.status).toBe(401);
    }
  });
});
