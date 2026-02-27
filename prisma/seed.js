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
          subtitle: 'Edicion Deluxe',
          description: 'Classic comic graphic novel',
          author: 'Alan Moore',
          publisher: 'DC Comics',
          genre: 'Novela grafica',
          seriesName: 'Watchmen',
          seriesNumber: 1,
          language: 'Espanol',
          binding: 'Tapa Blanda',
          edition: 'Edicion ilustrada',
          illustrator: 'Dave Gibbons',
          editor: 'Len Wein',
          originCountry: 'Argentina',
          publicationYear: 2019,
          publicationDate: new Date('2019-04-15T00:00:00.000Z'),
          pageCount: 416,
          dimensions: '26x17 cm',
          heightCm: 26,
          widthCm: 17,
          thicknessCm: 2.3,
          weightGrams: 730,
          conditionLabel: 'Nuevo',
          isbn: '9781401294052',
          isbn13: '9781401294052',
          ean: '9781401294052',
          shippingEtaMinDays: 2,
          shippingEtaMaxDays: 5,
          sku: 'COMIC-WATCHMEN-001',
          type: ProductType.COMIC,
          price: 29.99,
          stock: 50,
          isFeatured: true,
        },
        {
          title: 'Dune',
          subtitle: 'La saga que cambio la ciencia ficcion',
          description: 'Sci-fi epic novel',
          author: 'Frank Herbert',
          publisher: 'Debolsillo',
          genre: 'Ciencia ficcion',
          seriesName: 'Cronicas de Dune',
          seriesNumber: 1,
          language: 'Espanol',
          binding: 'Tapa Blanda',
          edition: '1ra edicion',
          translator: 'Juan Pascual Martinez',
          originCountry: 'Argentina',
          publicationYear: 2021,
          publicationDate: new Date('2021-07-20T00:00:00.000Z'),
          pageCount: 784,
          dimensions: '23x15 cm',
          heightCm: 23,
          widthCm: 15,
          thicknessCm: 3.4,
          weightGrams: 810,
          conditionLabel: 'Nuevo',
          isbn: '9788466353779',
          isbn13: '9788466353779',
          ean: '9788466353779',
          shippingEtaMinDays: 2,
          shippingEtaMaxDays: 6,
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
