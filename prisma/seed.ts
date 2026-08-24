import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, $Enums } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function ecocashRef() {
  return "EC" + Math.floor(1000000000 + Math.random() * 8999999999).toString();
}

async function main() {
  await prisma.paymentEvent.deleteMany();
  await prisma.rentRecord.deleteMany();
  await prisma.complaintMessage.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.tenancy.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.billingEvent.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: "seed_org_chiedza_properties",
      name: "Chiedza Properties",
      tier: $Enums.SubscriptionTier.PRO,
      subscriptionStatus: $Enums.SubscriptionStatus.TRIALING,
      trialEndsAt,
      smsCredits: 120,
      atSenderId: "PROPFLOW",
    },
  });

  const landlord = await prisma.user.create({
    data: {
      clerkId: "seed_landlord_tendai_mukamuri",
      email: "tendai.mukamuri@chiedzaproperties.co.zw",
      name: "Tendai Mukamuri",
      phone: "+263 77 123 4567",
      role: $Enums.UserRole.LANDLORD,
      orgId: org.id,
    },
  });

  const propertiesSeed = [
    {
      name: "Borrowdale Gardens",
      address: "45 Borrowdale Road",
      suburb: "Borrowdale",
      city: "Harare",
      province: "Harare",
      type: $Enums.PropertyType.FLAT,
      totalUnits: 12,
      unitsToCreate: 4,
    },
    {
      name: "Avondale Court",
      address: "12 King George Road",
      suburb: "Avondale",
      city: "Harare",
      province: "Harare",
      type: $Enums.PropertyType.FLAT,
      totalUnits: 8,
      unitsToCreate: 4,
    },
    {
      name: "Bulawayo Heights",
      address: "7 Jason Moyo Avenue",
      suburb: "CBD",
      city: "Bulawayo",
      province: "Matabeleland South",
      type: $Enums.PropertyType.FLAT,
      totalUnits: 6,
      unitsToCreate: 4,
    },
  ];

  const tenantNames = [
    "Chipo Mutasa",
    "Tatenda Moyo",
    "Farai Ncube",
    "Rudo Dube",
    "Simba Chirwa",
    "Tsitsi Mpofu",
    "Kudakwashe Banda",
    "Blessing Nyoni",
  ];

  let tenantIndex = 0;
  const occupiedUnits: {
    unitId: string;
    tenantId: string;
    tenantName: string;
    propertyName: string;
  }[] = [];

  for (const p of propertiesSeed) {
    const property = await prisma.property.create({
      data: {
        orgId: org.id,
        name: p.name,
        address: p.address,
        suburb: p.suburb,
        city: p.city,
        province: p.province,
        type: p.type,
        totalUnits: p.totalUnits,
        ownerId: landlord.id,
        primaryCurrency: $Enums.Currency.USD,
      },
    });

    for (let i = 1; i <= p.unitsToCreate; i++) {
      const isVacant = tenantIndex >= tenantNames.length;
      const unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: String(i).padStart(2, "0"),
          bedrooms: i % 2 === 0 ? 2 : 1,
          bathrooms: 1,
          rentAmountUsd: 250 + i * 25,
          depositAmount: 250 + i * 25,
          isVacant,
        },
      });

      if (!isVacant) {
        const tenantName = tenantNames[tenantIndex];
        const [firstName] = tenantName.split(" ");
        const phoneSuffix = String(700000000 + tenantIndex * 1111).slice(-7);
        const tenantUser = await prisma.user.create({
          data: {
            clerkId: `seed_tenant_${firstName.toLowerCase()}`,
            email: `${firstName.toLowerCase()}@example.co.zw`,
            name: tenantName,
            phone: `+263 7${phoneSuffix.slice(0, 1)} ${phoneSuffix.slice(1, 4)} ${phoneSuffix.slice(4)}`,
            role: $Enums.UserRole.TENANT,
          },
        });

        await prisma.tenancy.create({
          data: {
            unitId: unit.id,
            tenantId: tenantUser.id,
            startDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
            rentDueDay: 1,
            currency: $Enums.Currency.USD,
          },
        });

        await prisma.unit.update({
          where: { id: unit.id },
          data: { isVacant: false },
        });

        occupiedUnits.push({
          unitId: unit.id,
          tenantId: tenantUser.id,
          tenantName,
          propertyName: property.name,
        });

        tenantIndex++;
      }
    }
  }

  const complaintsSeed = [
    {
      title: "Water pump not working — no water pressure since Monday",
      category: "Plumbing",
      priority: $Enums.ComplaintPriority.HIGH,
    },
    {
      title: "Prepaid electricity meter making clicking noise",
      category: "Electrical",
      priority: $Enums.ComplaintPriority.MEDIUM,
    },
    {
      title: "Borehole pump tripped — no water in building",
      category: "Water/Borehole",
      priority: $Enums.ComplaintPriority.CRITICAL,
    },
    {
      title: "Gate motor broken — security risk",
      category: "Security",
      priority: $Enums.ComplaintPriority.HIGH,
    },
    {
      title: "Geyser not heating — cold water only",
      category: "Plumbing",
      priority: $Enums.ComplaintPriority.MEDIUM,
    },
    {
      title: "Sewage smell from drain in bathroom",
      category: "Plumbing",
      priority: $Enums.ComplaintPriority.HIGH,
    },
    {
      title: "Roof leaking above bedroom — rainy season damage",
      category: "Structure",
      priority: $Enums.ComplaintPriority.CRITICAL,
    },
  ];

  for (let i = 0; i < complaintsSeed.length; i++) {
    const unit = occupiedUnits[i % occupiedUnits.length];
    const c = complaintsSeed[i];
    await prisma.complaint.create({
      data: {
        unitId: unit.unitId,
        tenantId: unit.tenantId,
        title: c.title,
        description: c.title,
        category: c.category,
        priority: c.priority,
        status: i === 0 ? $Enums.ComplaintStatus.IN_PROGRESS : $Enums.ComplaintStatus.OPEN,
      },
    });
  }

  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();

  for (let i = 0; i < occupiedUnits.length; i++) {
    const u = occupiedUnits[i];
    const unitRecord = await prisma.unit.findUniqueOrThrow({ where: { id: u.unitId } });
    const amountDueUsd = unitRecord.rentAmountUsd ?? 250;

    let status: $Enums.RentStatus = $Enums.RentStatus.PAID;
    let amountPaidUsd = amountDueUsd;
    let paymentMethod: $Enums.PaymentMethod | null = $Enums.PaymentMethod.ECOCASH;
    let referenceNo: string | null = ecocashRef();
    let proofImageUrl: string | null = null;
    let paidAt: Date | null = new Date(periodYear, periodMonth - 1, 3);

    if (i === occupiedUnits.length - 1) {
      status = $Enums.RentStatus.OVERDUE;
      amountPaidUsd = 0;
      paymentMethod = null;
      referenceNo = null;
      paidAt = null;
    } else if (i === occupiedUnits.length - 2) {
      status = $Enums.RentStatus.PENDING;
      amountPaidUsd = 0;
      paymentMethod = $Enums.PaymentMethod.ECOCASH;
      referenceNo = ecocashRef();
      proofImageUrl = "https://uploads.propflow.co.zw/seed/proof-placeholder.jpg";
      paidAt = null;
    } else if (i % 4 === 1) {
      paymentMethod = $Enums.PaymentMethod.BANK_TRANSFER;
      referenceNo = null;
    } else if (i % 4 === 2) {
      paymentMethod = $Enums.PaymentMethod.CASH_USD;
      referenceNo = null;
    }

    const rentRecord = await prisma.rentRecord.create({
      data: {
        unitId: u.unitId,
        tenantId: u.tenantId,
        periodMonth,
        periodYear,
        amountDueUsd,
        amountPaidUsd,
        currency: $Enums.Currency.USD,
        status,
        paymentMethod: paymentMethod ?? undefined,
        referenceNo: referenceNo ?? undefined,
        proofImageUrl: proofImageUrl ?? undefined,
        paidAt: paidAt ?? undefined,
      },
    });

    if (status === $Enums.RentStatus.PAID) {
      await prisma.paymentEvent.create({
        data: {
          rentRecordId: rentRecord.id,
          actorId: landlord.id,
          source: $Enums.PaymentEventSource.MANUAL,
          fromStatus: $Enums.RentStatus.PENDING,
          toStatus: $Enums.RentStatus.PAID,
          amountUsd: amountPaidUsd,
          method: paymentMethod ?? undefined,
          referenceNo: referenceNo ?? undefined,
        },
      });
    }
  }

  await prisma.exchangeRate.create({
    data: {
      usdToZig: 13500,
      source: "manual",
    },
  });

  console.log(`Seeded: 1 org, 1 landlord, ${occupiedUnits.length} tenants, ${propertiesSeed.length} properties, ${complaintsSeed.length} complaints, ${occupiedUnits.length} rent records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
