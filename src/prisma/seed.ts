import { prisma } from "../lib/prisma";

const products = [
  {
    name: "Starter",
    description: "First-time borrowers building a track record.",
    minAmount: 500,
    maxAmount: 2000,
    interestRate: 0.12,
    processingFeeRate: 0.02,
    termDays: 14,
    minCredibility: 300,
    guarantorsRequired: 2,
    sortOrder: 1,
  },
  {
    name: "Bronze",
    description: "Short-term cash for everyday needs.",
    minAmount: 2000,
    maxAmount: 5000,
    interestRate: 0.11,
    processingFeeRate: 0.02,
    termDays: 30,
    minCredibility: 400,
    guarantorsRequired: 2,
    sortOrder: 2,
  },
  {
    name: "Silver",
    description: "Bigger limits for consistent repayers.",
    minAmount: 5001,
    maxAmount: 15000,
    interestRate: 0.1,
    processingFeeRate: 0.015,
    termDays: 45,
    minCredibility: 550,
    guarantorsRequired: 2,
    sortOrder: 3,
  },
  {
    name: "Gold",
    description: "Business boost loans with lower rates.",
    minAmount: 15000,
    maxAmount: 40000,
    interestRate: 0.08,
    processingFeeRate: 0.015,
    termDays: 60,
    minCredibility: 700,
    guarantorsRequired: 2,
    sortOrder: 4,
  },
  {
    name: "Platinum",
    description: "Premium tier for our most trusted members.",
    minAmount: 40000,
    maxAmount: 100000,
    interestRate: 0.06,
    processingFeeRate: 0.01,
    termDays: 90,
    minCredibility: 850,
    guarantorsRequired: 3,
    sortOrder: 5,
  },
];

async function main() {
  for (const product of products) {
    await prisma.loanProduct.upsert({
      where: { name: product.name },
      create: product,
      update: product,
    });
  }
  console.log(`Seeded ${products.length} loan products.`);

  const existingSettings = await prisma.businessSettings.findFirst();
  if (!existingSettings) {
    await prisma.businessSettings.create({
      data: {
        id: "default-settings",
        businessName: process.env["BUSINESS_NAME"] || "Lending Platform",
        businessLocation: "Nairobi, Kenya",
        supportPhone: "+254700000000",
        supportEmail: process.env["SUPPORT_EMAIL"] || "",
        currency: "KES",
        setupCompleted: true,
      },
    });
    console.log("Seeded default business settings.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
