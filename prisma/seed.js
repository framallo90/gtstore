try {
  // Ensure ADMIN_EMAIL / ADMIN_PASSWORD from .env are available when running `node prisma/seed.js`.
  require('dotenv/config');
} catch {
  // ignore
}

const { PrismaClient, Role, ProductType } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    if (adminPassword.length < 8) {
      console.warn(
        'ADMIN_PASSWORD must be at least 8 characters; skipping admin seed.',
      );
    } else {
      const normalizedEmail = adminEmail.trim().toLowerCase();
      const existingAdmin = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
          data: {
            email: normalizedEmail,
            firstName: 'Geeky',
            lastName: 'Admin',
            passwordHash,
            role: Role.ADMIN,
          },
        });
      }
    }
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin seed.');
  }

  const productsCount = await prisma.product.count();
  if (productsCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          title: 'Watchmen',
          description: 'Classic comic graphic novel',
          author: 'Alan Moore',
          sku: 'COMIC-WATCHMEN-001',
          type: ProductType.COMIC,
          price: 29.99,
          stock: 50,
          isFeatured: true,
        },
        {
          title: 'Dune',
          description: 'Sci-fi epic novel',
          author: 'Frank Herbert',
          sku: 'BOOK-DUNE-001',
          type: ProductType.BOOK,
          price: 19.99,
          stock: 80,
          isFeatured: true,
        },
      ],
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
