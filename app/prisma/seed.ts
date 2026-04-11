import {
  CommunicationChannel,
  CouponDiscountType,
  EmployeeSubRole,
  GuestTier,
  LeadSource,
  LeadStage,
  PrismaClient,
  RideStatus,
  UserRole,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

const IDS = {
  parkConfig: "seed_park_config_aquaworld",
  users: {
    admin: "seed_user_admin",
    ravi: "seed_user_ravi",
    priya: "seed_user_priya",
    suresh: "seed_user_suresh",
    meena: "seed_user_meena",
    ankit: "seed_user_ankit",
  },
  accounts: {
    admin: "seed_account_admin",
    ravi: "seed_account_ravi",
    priya: "seed_account_priya",
    suresh: "seed_account_suresh",
    meena: "seed_account_meena",
    ankit: "seed_account_ankit",
  },
  staffProfiles: {
    ravi: "seed_staff_ravi",
    priya: "seed_staff_priya",
    suresh: "seed_staff_suresh",
    meena: "seed_staff_meena",
    ankit: "seed_staff_ankit",
  },
  zones: {
    wave: "seed_zone_wave_pool",
    kids: "seed_zone_kids",
    thrill: "seed_zone_thrill",
    food: "seed_zone_food_court",
  },
  tickets: {
    adult: "seed_ticket_adult",
    child: "seed_ticket_child",
    toddler: "seed_ticket_toddler",
    senior: "seed_ticket_senior",
    family: "seed_ticket_family",
  },
  rides: {
    wavePool: "seed_ride_wave_pool",
    lazyRiver: "seed_ride_lazy_river",
    miniSlides: "seed_ride_mini_slides",
    kiddyPool: "seed_ride_kiddy_pool",
    tornadoSlide: "seed_ride_tornado_slide",
    freeFall: "seed_ride_free_fall",
    speedRacer: "seed_ride_speed_racer",
    tunnelSplash: "seed_ride_tunnel_splash",
  },
  lockerZones: {
    mainGate: "seed_locker_zone_main_gate",
    wavePool: "seed_locker_zone_wave_pool",
    kids: "seed_locker_zone_kids",
  },
  food: {
    outletMain: "seed_food_outlet_main",
    catCombos: "seed_food_cat_combos",
    catBeverages: "seed_food_cat_beverages",
    catSnacks: "seed_food_cat_snacks",
    itemFamilyCombo: "seed_food_item_family_combo",
    itemVegBurger: "seed_food_item_veg_burger",
    itemFries: "seed_food_item_fries",
    itemColdCoffee: "seed_food_item_cold_coffee",
    itemFreshLime: "seed_food_item_fresh_lime",
  },
  costume: {
    catMermaid: "seed_costume_cat_mermaid",
    catPirate: "seed_costume_cat_pirate",
    catSuperhero: "seed_costume_cat_superhero",
    itemMermaidM: "seed_costume_item_mermaid_m",
    itemPirateL: "seed_costume_item_pirate_l",
    itemHeroKids: "seed_costume_item_hero_kids",
  },
  leads: {
    infosys: "seed_lead_infosys",
    dps: "seed_lead_dps",
    sharmaWedding: "seed_lead_sharma_wedding",
  },
} as const;

type SeedUser = {
  id: string;
  accountId: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  subRole?: EmployeeSubRole;
  password: string;
  employeeCode?: string;
};

async function upsertAndLog<T>(label: string, action: () => Promise<T>): Promise<T> {
  const result = await action();
  console.log(`Seeded: ${label}`);
  return result;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function seedParkConfig(): Promise<void> {
  await upsertAndLog("Park Config - AquaWorld Park", () =>
    prisma.parkConfig.upsert({
      where: { id: IDS.parkConfig },
      update: {
        parkName: "AquaWorld Park",
        maxCapacityPerDay: 2000,
        defaultGstRate: "18.00",
        address: "Hingna Road, Nagpur, Maharashtra",
        city: "Nagpur",
        state: "Maharashtra",
        pincode: "440016",
        phone: "+91-712-400-2200",
        email: "hello@aquaworldpark.in",
        websiteUrl: "https://aquaworldpark.in",
        upiId: "aquaworld@okaxis",
        upiName: "AquaWorld Park",
        loyaltyPointsPerRupee: "1.00",
      },
      create: {
        id: IDS.parkConfig,
        parkName: "AquaWorld Park",
        maxCapacityPerDay: 2000,
        defaultGstRate: "18.00",
        address: "Hingna Road, Nagpur, Maharashtra",
        city: "Nagpur",
        state: "Maharashtra",
        pincode: "440016",
        phone: "+91-712-400-2200",
        email: "hello@aquaworldpark.in",
        websiteUrl: "https://aquaworldpark.in",
        upiId: "aquaworld@okaxis",
        upiName: "AquaWorld Park",
        loyaltyPointsPerRupee: "1.00",
      },
    }),
  );
}

async function seedUsersAndAccounts(): Promise<{
  salesExecutiveUserId: string;
  priyaUserId: string;
  sureshUserId: string;
}> {
  const departmentBySubRole: Record<string, string> = {
    TICKET_COUNTER: "Operations",
    RIDE_OPERATOR: "Ride Operations",
    FB_STAFF: "Food & Beverage",
    SECURITY_STAFF: "Security",
    SALES_EXECUTIVE: "Sales & CRM",
  };

  const users: SeedUser[] = [
    {
      id: IDS.users.admin,
      accountId: IDS.accounts.admin,
      name: "AquaWorld Admin",
      mobile: "9000000001",
      email: "admin@aquaworld.com",
      role: UserRole.ADMIN,
      password: "Admin@1234!",
    },
    {
      id: IDS.users.ravi,
      accountId: IDS.accounts.ravi,
      name: "Ravi Kumar",
      mobile: "9000000002",
      email: "ravi@aquaworld.com",
      role: UserRole.EMPLOYEE,
      subRole: EmployeeSubRole.TICKET_COUNTER,
      password: "Staff@1234!",
      employeeCode: "WP-EMP-0002",
    },
    {
      id: IDS.users.priya,
      accountId: IDS.accounts.priya,
      name: "Priya Sharma",
      mobile: "9000000003",
      email: "priya@aquaworld.com",
      role: UserRole.EMPLOYEE,
      subRole: EmployeeSubRole.RIDE_OPERATOR,
      password: "Staff@1234!",
      employeeCode: "WP-EMP-0003",
    },
    {
      id: IDS.users.suresh,
      accountId: IDS.accounts.suresh,
      name: "Suresh Patil",
      mobile: "9000000004",
      email: "suresh@aquaworld.com",
      role: UserRole.EMPLOYEE,
      subRole: EmployeeSubRole.FB_STAFF,
      password: "Staff@1234!",
      employeeCode: "WP-EMP-0004",
    },
    {
      id: IDS.users.meena,
      accountId: IDS.accounts.meena,
      name: "Meena Joshi",
      mobile: "9000000005",
      email: "meena@aquaworld.com",
      role: UserRole.EMPLOYEE,
      subRole: EmployeeSubRole.SECURITY_STAFF,
      password: "Staff@1234!",
      employeeCode: "WP-EMP-0005",
    },
    {
      id: IDS.users.ankit,
      accountId: IDS.accounts.ankit,
      name: "Ankit Verma",
      mobile: "9000000006",
      email: "ankit@aquaworld.com",
      role: UserRole.EMPLOYEE,
      subRole: EmployeeSubRole.SALES_EXECUTIVE,
      password: "Staff@1234!",
      employeeCode: "WP-EMP-0006",
    },
  ];

  const seededUserIds: Record<string, string> = {};

  for (const user of users) {
    const passwordHash = await hashPassword(user.password);

    const dbUser = (await upsertAndLog(`User - ${user.mobile} (${user.name})`, () =>
      prisma.user.upsert({
        where: { mobile: user.mobile },
        update: {
          name: user.name,
          email: user.email,
          emailVerified: true,
          mobileVerified: true,
          role: user.role,
          subRole: user.subRole,
          passwordHash,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true,
          mobile: user.mobile,
          mobileVerified: true,
          passwordHash,
          role: user.role,
          subRole: user.subRole,
          isActive: true,
          isDeleted: false,
        },
      }),
    )) as { id: string };
    seededUserIds[user.id] = dbUser.id;

    await upsertAndLog(`Credential Account - ${user.mobile}`, () =>
      prisma.account.upsert({
        where: { id: user.accountId },
        update: {
          accountId: dbUser.id,
          providerId: "credential",
          userId: dbUser.id,
          password: passwordHash,
        },
        create: {
          id: user.accountId,
          accountId: dbUser.id,
          providerId: "credential",
          userId: dbUser.id,
          password: passwordHash,
        },
      }),
    );

    if (user.role === "EMPLOYEE" && user.employeeCode) {
      const employeeCode = user.employeeCode;
      const subRole = user.subRole;
      await upsertAndLog(`Staff Profile - ${user.employeeCode}`, () =>
        prisma.staffProfile.upsert({
          where: { userId: dbUser.id },
          update: {
            employeeCode,
            department: (subRole && departmentBySubRole[subRole]) || "Operations",
            joiningDate: new Date("2024-04-01"),
            isActive: true,
          },
          create: {
            id: IDS.staffProfiles[user.name.split(" ")[0].toLowerCase() as keyof typeof IDS.staffProfiles],
            userId: dbUser.id,
            employeeCode,
            department: (subRole && departmentBySubRole[subRole]) || "Operations",
            joiningDate: new Date("2024-04-01"),
            isActive: true,
          },
        }),
      );
    }
  }

  return {
    salesExecutiveUserId: seededUserIds[IDS.users.ankit] ?? IDS.users.ankit,
    priyaUserId: seededUserIds[IDS.users.priya] ?? IDS.users.priya,
    sureshUserId: seededUserIds[IDS.users.suresh] ?? IDS.users.suresh,
  };
}

async function assignSeededOwnership(priyaUserId: string, sureshUserId: string): Promise<void> {
  await upsertAndLog("Ride Operator Assignment - Priya -> First Seeded Ride", () =>
    prisma.ride.update({
      where: { id: IDS.rides.wavePool },
      data: { operatorId: priyaUserId },
    }),
  );

  const firstOutlet = await prisma.foodOutlet.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, description: true, name: true },
  });

  if (!firstOutlet) {
    console.log("Seeded: Outlet Assignment - skipped (no outlets found)");
    return;
  }

  const suresh = await prisma.user.findUnique({
    where: { id: sureshUserId },
    select: { email: true },
  });
  const marker = `Assigned Staff: ${suresh?.email ?? "suresh@aquaworld.com"} (FB_STAFF)`;
  const current = firstOutlet.description ?? "";
  const nextDescription = current.includes(marker) ? current : `${current}${current ? "\n" : ""}${marker}`;

  await upsertAndLog(`Outlet Assignment - Suresh -> ${firstOutlet.name}`, () =>
    prisma.foodOutlet.update({
      where: { id: firstOutlet.id },
      data: { description: nextDescription },
    }),
  );
}

async function seedZones(): Promise<void> {
  const zones = [
    { id: IDS.zones.wave, name: "Wave Pool Zone", sortOrder: 1 },
    { id: IDS.zones.kids, name: "Kids Zone", sortOrder: 2 },
    { id: IDS.zones.thrill, name: "Thrill Zone", sortOrder: 3 },
    { id: IDS.zones.food, name: "Food Court Zone", sortOrder: 4 },
  ];

  for (const zone of zones) {
    await upsertAndLog(`Zone - ${zone.name}`, () =>
      prisma.zone.upsert({
        where: { id: zone.id },
        update: {
          name: zone.name,
          isActive: true,
          sortOrder: zone.sortOrder,
          description: `${zone.name} at AquaWorld Park`,
        },
        create: {
          id: zone.id,
          name: zone.name,
          isActive: true,
          sortOrder: zone.sortOrder,
          description: `${zone.name} at AquaWorld Park`,
        },
      }),
    );
  }
}

async function seedTicketTypes(): Promise<void> {
  const ticketTypes = [
    {
      id: IDS.tickets.adult,
      name: "Adult Day Pass",
      description: "Full day access for adults (12 years and above)",
      price: "699.00",
      gstRate: "18.00",
      minAge: 12,
      maxAge: null,
      sortOrder: 1,
    },
    {
      id: IDS.tickets.child,
      name: "Child Day Pass",
      description: "Day access for kids between 3 and 11 years",
      price: "449.00",
      gstRate: "18.00",
      minAge: 3,
      maxAge: 11,
      sortOrder: 2,
    },
    {
      id: IDS.tickets.toddler,
      name: "Toddler Pass",
      description: "Free entry for toddlers up to 2 years",
      price: "0.00",
      gstRate: "0.00",
      minAge: 0,
      maxAge: 2,
      sortOrder: 3,
    },
    {
      id: IDS.tickets.senior,
      name: "Senior Pass",
      description: "Discounted day access for senior citizens",
      price: "499.00",
      gstRate: "18.00",
      minAge: 60,
      maxAge: null,
      sortOrder: 4,
    },
    {
      id: IDS.tickets.family,
      name: "Family Pack (4+1)",
      description: "Bundle pass for families with 5 entries",
      price: "2199.00",
      gstRate: "18.00",
      minAge: null,
      maxAge: null,
      sortOrder: 5,
    },
  ];

  for (const ticket of ticketTypes) {
    await upsertAndLog(`Ticket Type - ${ticket.name}`, () =>
      prisma.ticketType.upsert({
        where: { id: ticket.id },
        update: {
          name: ticket.name,
          description: ticket.description,
          price: ticket.price,
          gstRate: ticket.gstRate,
          validDays: 1,
          minAge: ticket.minAge,
          maxAge: ticket.maxAge,
          maxPerBooking: 10,
          sortOrder: ticket.sortOrder,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          id: ticket.id,
          name: ticket.name,
          description: ticket.description,
          price: ticket.price,
          gstRate: ticket.gstRate,
          validDays: 1,
          minAge: ticket.minAge,
          maxAge: ticket.maxAge,
          maxPerBooking: 10,
          sortOrder: ticket.sortOrder,
          isActive: true,
          isDeleted: false,
        },
      }),
    );
  }
}

async function seedRides(): Promise<void> {
  const rides: Array<{
    id: string;
    name: string;
    zoneId: string;
    status: RideStatus;
    minHeight: number | null;
    maxWeight: number | null;
    durationMin: number;
    capacity: number;
    sortOrder: number;
  }> = [
    {
      id: IDS.rides.wavePool,
      name: "Wave Pool",
      zoneId: IDS.zones.wave,
      status: RideStatus.ACTIVE,
      minHeight: null,
      maxWeight: null,
      durationMin: 20,
      capacity: 200,
      sortOrder: 1,
    },
    {
      id: IDS.rides.lazyRiver,
      name: "Lazy River",
      zoneId: IDS.zones.wave,
      status: RideStatus.ACTIVE,
      minHeight: null,
      maxWeight: null,
      durationMin: 25,
      capacity: 120,
      sortOrder: 2,
    },
    {
      id: IDS.rides.miniSlides,
      name: "Mini Slides",
      zoneId: IDS.zones.kids,
      status: RideStatus.ACTIVE,
      minHeight: 90,
      maxWeight: 60,
      durationMin: 5,
      capacity: 24,
      sortOrder: 3,
    },
    {
      id: IDS.rides.kiddyPool,
      name: "Kiddy Pool",
      zoneId: IDS.zones.kids,
      status: RideStatus.ACTIVE,
      minHeight: null,
      maxWeight: null,
      durationMin: 30,
      capacity: 60,
      sortOrder: 4,
    },
    {
      id: IDS.rides.tornadoSlide,
      name: "Tornado Slide",
      zoneId: IDS.zones.thrill,
      status: RideStatus.ACTIVE,
      minHeight: 140,
      maxWeight: 110,
      durationMin: 4,
      capacity: 16,
      sortOrder: 5,
    },
    {
      id: IDS.rides.freeFall,
      name: "Free Fall",
      zoneId: IDS.zones.thrill,
      status: RideStatus.ACTIVE,
      minHeight: 145,
      maxWeight: 100,
      durationMin: 3,
      capacity: 10,
      sortOrder: 6,
    },
    {
      id: IDS.rides.speedRacer,
      name: "Speed Racer",
      zoneId: IDS.zones.thrill,
      status: RideStatus.ACTIVE,
      minHeight: 130,
      maxWeight: 105,
      durationMin: 3,
      capacity: 12,
      sortOrder: 7,
    },
    {
      id: IDS.rides.tunnelSplash,
      name: "Tunnel Splash",
      zoneId: IDS.zones.thrill,
      status: RideStatus.MAINTENANCE,
      minHeight: 130,
      maxWeight: 100,
      durationMin: 4,
      capacity: 14,
      sortOrder: 8,
    },
  ];

  for (const ride of rides) {
    await upsertAndLog(`Ride - ${ride.name}`, () =>
      prisma.ride.upsert({
        where: { id: ride.id },
        update: {
          name: ride.name,
          zoneId: ride.zoneId,
          status: ride.status,
          minHeight: ride.minHeight,
          maxWeight: ride.maxWeight,
          durationMin: ride.durationMin,
          capacity: ride.capacity,
          sortOrder: ride.sortOrder,
          isDeleted: false,
          deletedAt: null,
          description: `${ride.name} at AquaWorld Park`,
        },
        create: {
          id: ride.id,
          name: ride.name,
          zoneId: ride.zoneId,
          status: ride.status,
          minHeight: ride.minHeight,
          maxWeight: ride.maxWeight,
          durationMin: ride.durationMin,
          capacity: ride.capacity,
          sortOrder: ride.sortOrder,
          isDeleted: false,
          description: `${ride.name} at AquaWorld Park`,
        },
      }),
    );
  }
}

async function seedLockerData(): Promise<void> {
  const zones = [
    { id: IDS.lockerZones.mainGate, name: "Main Gate Lockers", location: "Entrance Plaza" },
    { id: IDS.lockerZones.wavePool, name: "Wave Pool Lockers", location: "Wave Pool Deck" },
    { id: IDS.lockerZones.kids, name: "Kids Zone Lockers", location: "Kids Splash Area" },
  ];

  for (const zone of zones) {
    await upsertAndLog(`Locker Zone - ${zone.name}`, () =>
      prisma.lockerZone.upsert({
        where: { id: zone.id },
        update: { name: zone.name, location: zone.location, isActive: true },
        create: { id: zone.id, name: zone.name, location: zone.location, isActive: true },
      }),
    );
  }

  const lockers: Array<{ zoneId: string; number: string; size: "SMALL" | "MEDIUM" | "LARGE" }> = [
    { zoneId: IDS.lockerZones.mainGate, number: "MG-001", size: "SMALL" },
    { zoneId: IDS.lockerZones.mainGate, number: "MG-002", size: "MEDIUM" },
    { zoneId: IDS.lockerZones.mainGate, number: "MG-003", size: "LARGE" },
    { zoneId: IDS.lockerZones.wavePool, number: "WP-001", size: "SMALL" },
    { zoneId: IDS.lockerZones.wavePool, number: "WP-002", size: "MEDIUM" },
    { zoneId: IDS.lockerZones.wavePool, number: "WP-003", size: "LARGE" },
    { zoneId: IDS.lockerZones.kids, number: "KZ-001", size: "SMALL" },
    { zoneId: IDS.lockerZones.kids, number: "KZ-002", size: "MEDIUM" },
  ];

  for (const locker of lockers) {
    await upsertAndLog(`Locker - ${locker.number}`, () =>
      prisma.locker.upsert({
        where: { number: locker.number },
        update: {
          zoneId: locker.zoneId,
          size: locker.size,
          status: "AVAILABLE",
          isActive: true,
        },
        create: {
          zoneId: locker.zoneId,
          number: locker.number,
          size: locker.size,
          status: "AVAILABLE",
          isActive: true,
        },
      }),
    );
  }
}

async function seedFoodData(): Promise<void> {
  await upsertAndLog("Food Outlet - Main Food Court", () =>
    prisma.foodOutlet.upsert({
      where: { id: IDS.food.outletMain },
      update: {
        name: "Main Food Court",
        description: "Central food court for walk-in and booked guests.",
        location: "Food Court Zone",
        isOpen: true,
        isActive: true,
        sortOrder: 1,
      },
      create: {
        id: IDS.food.outletMain,
        name: "Main Food Court",
        description: "Central food court for walk-in and booked guests.",
        location: "Food Court Zone",
        isOpen: true,
        isActive: true,
        sortOrder: 1,
      },
    }),
  );

  const categories = [
    { id: IDS.food.catCombos, name: "Combos", sortOrder: 1 },
    { id: IDS.food.catSnacks, name: "Snacks", sortOrder: 2 },
    { id: IDS.food.catBeverages, name: "Beverages", sortOrder: 3 },
  ];

  for (const category of categories) {
    await upsertAndLog(`Food Category - ${category.name}`, () =>
      prisma.foodCategory.upsert({
        where: { id: category.id },
        update: {
          outletId: IDS.food.outletMain,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          id: category.id,
          outletId: IDS.food.outletMain,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      }),
    );
  }

  const items: Array<{
    id: string;
    categoryId: string;
    name: string;
    price: string;
    preBookPrice: string | null;
    gstRate: string;
    isVeg: boolean;
    sortOrder: number;
    description: string;
  }> = [
    {
      id: IDS.food.itemFamilyCombo,
      categoryId: IDS.food.catCombos,
      name: "Family Combo (2 Burgers + 2 Fries + 2 Drinks)",
      price: "799.00",
      preBookPrice: "749.00",
      gstRate: "5.00",
      isVeg: true,
      sortOrder: 1,
      description: "Best-value combo for families.",
    },
    {
      id: IDS.food.itemVegBurger,
      categoryId: IDS.food.catSnacks,
      name: "Veg Burger",
      price: "149.00",
      preBookPrice: "129.00",
      gstRate: "5.00",
      isVeg: true,
      sortOrder: 1,
      description: "Classic veg burger with crispy patty.",
    },
    {
      id: IDS.food.itemFries,
      categoryId: IDS.food.catSnacks,
      name: "French Fries (Regular)",
      price: "99.00",
      preBookPrice: null,
      gstRate: "5.00",
      isVeg: true,
      sortOrder: 2,
      description: "Salted crispy fries.",
    },
    {
      id: IDS.food.itemColdCoffee,
      categoryId: IDS.food.catBeverages,
      name: "Cold Coffee (350ml)",
      price: "129.00",
      preBookPrice: null,
      gstRate: "5.00",
      isVeg: true,
      sortOrder: 1,
      description: "Chilled cold coffee.",
    },
    {
      id: IDS.food.itemFreshLime,
      categoryId: IDS.food.catBeverages,
      name: "Fresh Lime Soda",
      price: "89.00",
      preBookPrice: null,
      gstRate: "5.00",
      isVeg: true,
      sortOrder: 2,
      description: "Refreshing lemon soda.",
    },
  ];

  for (const item of items) {
    await upsertAndLog(`Food Item - ${item.name}`, () =>
      prisma.foodItem.upsert({
        where: { id: item.id },
        update: {
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          preBookPrice: item.preBookPrice,
          gstRate: item.gstRate,
          isVeg: item.isVeg,
          isAvailable: true,
          sortOrder: item.sortOrder,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          preBookPrice: item.preBookPrice,
          gstRate: item.gstRate,
          isVeg: item.isVeg,
          isAvailable: true,
          sortOrder: item.sortOrder,
          isDeleted: false,
        },
      }),
    );
  }
}

async function seedCostumeData(): Promise<void> {
  const categories = [
    {
      id: IDS.costume.catMermaid,
      name: "Mermaid",
      description: "Mermaid themed costumes for photos and events.",
      sortOrder: 1,
    },
    {
      id: IDS.costume.catPirate,
      name: "Pirate",
      description: "Pirate themed costumes.",
      sortOrder: 2,
    },
    {
      id: IDS.costume.catSuperhero,
      name: "Superhero",
      description: "Superhero costumes for kids and adults.",
      sortOrder: 3,
    },
  ];

  for (const category of categories) {
    await upsertAndLog(`Costume Category - ${category.name}`, () =>
      prisma.costumeCategory.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          id: category.id,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      }),
    );
  }

  const items: Array<{
    id: string;
    categoryId: string;
    tagNumber: string;
    name: string;
    size: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "KIDS_S" | "KIDS_M" | "KIDS_L";
    rentalRate: string;
    depositRate: string;
    gstRate: string;
    notes?: string;
  }> = [
    {
      id: IDS.costume.itemMermaidM,
      categoryId: IDS.costume.catMermaid,
      tagNumber: "MER-1001",
      name: "Mermaid Dress - M",
      size: "M",
      rentalRate: "299.00",
      depositRate: "200.00",
      gstRate: "5.00",
    },
    {
      id: IDS.costume.itemPirateL,
      categoryId: IDS.costume.catPirate,
      tagNumber: "PIR-2001",
      name: "Pirate Costume - L",
      size: "L",
      rentalRate: "349.00",
      depositRate: "250.00",
      gstRate: "5.00",
    },
    {
      id: IDS.costume.itemHeroKids,
      categoryId: IDS.costume.catSuperhero,
      tagNumber: "SUP-3001",
      name: "Superhero Suit - Kids M",
      size: "KIDS_M",
      rentalRate: "249.00",
      depositRate: "150.00",
      gstRate: "5.00",
    },
  ];

  for (const item of items) {
    await upsertAndLog(`Costume Item - ${item.tagNumber}`, () =>
      prisma.costumeItem.upsert({
        where: { id: item.id },
        update: {
          categoryId: item.categoryId,
          tagNumber: item.tagNumber,
          name: item.name,
          size: item.size,
          status: "AVAILABLE",
          rentalRate: item.rentalRate,
          depositRate: item.depositRate,
          gstRate: item.gstRate,
          isActive: true,
          notes: item.notes ?? null,
        },
        create: {
          id: item.id,
          categoryId: item.categoryId,
          tagNumber: item.tagNumber,
          name: item.name,
          size: item.size,
          status: "AVAILABLE",
          rentalRate: item.rentalRate,
          depositRate: item.depositRate,
          gstRate: item.gstRate,
          isActive: true,
          notes: item.notes ?? null,
        },
      }),
    );
  }
}

async function seedCoupons(): Promise<void> {
  const now = new Date();
  const coupons: Array<{
    code: string;
    description: string;
    discountType: CouponDiscountType;
    discountValue: string;
    minOrderAmount: string;
    maxDiscountCap: string | null;
    validTo: Date;
  }> = [
    {
      code: "WELCOME10",
      description: "Welcome offer for first booking",
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: "10.00",
      minOrderAmount: "500.00",
      maxDiscountCap: "400.00",
      validTo: addDays(now, 90),
    },
    {
      code: "FAMILY20",
      description: "Family pack special discount",
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: "20.00",
      minOrderAmount: "2000.00",
      maxDiscountCap: "800.00",
      validTo: addDays(now, 30),
    },
    {
      code: "FLAT100",
      description: "Flat INR 100 discount",
      discountType: CouponDiscountType.FLAT,
      discountValue: "100.00",
      minOrderAmount: "800.00",
      maxDiscountCap: null,
      validTo: addDays(now, 60),
    },
  ];

  for (const coupon of coupons) {
    await upsertAndLog(`Coupon - ${coupon.code}`, () =>
      prisma.coupon.upsert({
        where: { code: coupon.code },
        update: {
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderAmount: coupon.minOrderAmount,
          maxDiscountCap: coupon.maxDiscountCap,
          maxUses: 5000,
          usedCount: 0,
          validFrom: now,
          validTo: coupon.validTo,
          isActive: true,
          applicableFor: "ALL",
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderAmount: coupon.minOrderAmount,
          maxDiscountCap: coupon.maxDiscountCap,
          maxUses: 5000,
          usedCount: 0,
          validFrom: now,
          validTo: coupon.validTo,
          isActive: true,
          applicableFor: "ALL",
          isDeleted: false,
        },
      }),
    );
  }
}

async function seedMessageTemplates(): Promise<void> {
  const templates: Array<{
    name: string;
    channel: CommunicationChannel;
    subject: string | null;
    body: string;
    variables: string[];
  }> = [
    {
      name: "booking_confirmation",
      channel: CommunicationChannel.SMS,
      subject: null,
      body: "Hi {{guestName}}, booking {{bookingNumber}} confirmed for {{visitDate}} at AquaWorld Park.",
      variables: ["guestName", "bookingNumber", "visitDate"],
    },
    {
      name: "otp_verification",
      channel: CommunicationChannel.SMS,
      subject: null,
      body: "Your AquaWorld OTP is {{otp}}. It is valid for 5 minutes.",
      variables: ["otp"],
    },
    {
      name: "payment_reminder",
      channel: CommunicationChannel.SMS,
      subject: null,
      body: "Reminder: Please complete payment for booking {{bookingNumber}}. Amount due: Rs {{amount}}.",
      variables: ["bookingNumber", "amount"],
    },
    {
      name: "birthday_offer",
      channel: CommunicationChannel.WHATSAPP,
      subject: null,
      body: "Happy Birthday {{guestName}}! Enjoy {{offer}} on your next AquaWorld booking.",
      variables: ["guestName", "offer"],
    },
  ];

  for (const template of templates) {
    await upsertAndLog(`Message Template - ${template.name}`, () =>
      prisma.messageTemplate.upsert({
        where: { name: template.name },
        update: {
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
          isActive: true,
        },
        create: {
          name: template.name,
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
          isActive: true,
        },
      }),
    );
  }
}

async function seedGuestProfiles(): Promise<void> {
  const guests: Array<{
    mobile: string;
    name: string;
    email: string;
    tier: GuestTier;
    totalVisits: number;
    totalSpend: string;
    loyaltyPoints: number;
    lastVisitDate: Date;
    tags: string[];
  }> = [
    {
      mobile: "9876543210",
      name: "Amit Gupta",
      email: "amit.gupta@example.com",
      tier: GuestTier.SILVER,
      totalVisits: 5,
      totalSpend: "18450.00",
      loyaltyPoints: 3200,
      lastVisitDate: new Date("2026-02-10"),
      tags: ["returning", "family"],
    },
    {
      mobile: "9765432109",
      name: "Neha Singh",
      email: "neha.singh@example.com",
      tier: GuestTier.BRONZE,
      totalVisits: 2,
      totalSpend: "6300.00",
      loyaltyPoints: 800,
      lastVisitDate: new Date("2026-01-18"),
      tags: ["weekend"],
    },
    {
      mobile: "9654321098",
      name: "Rajesh Patil",
      email: "rajesh.patil@example.com",
      tier: GuestTier.GOLD,
      totalVisits: 12,
      totalSpend: "48200.00",
      loyaltyPoints: 7500,
      lastVisitDate: new Date("2026-03-03"),
      tags: ["vip", "corporate"],
    },
  ];

  for (const guest of guests) {
    await upsertAndLog(`Guest Profile - ${guest.name}`, () =>
      prisma.guestProfile.upsert({
        where: { mobile: guest.mobile },
        update: {
          name: guest.name,
          email: guest.email,
          tier: guest.tier,
          totalVisits: guest.totalVisits,
          totalSpend: guest.totalSpend,
          loyaltyPoints: guest.loyaltyPoints,
          lastVisitDate: guest.lastVisitDate,
          tags: guest.tags,
        },
        create: {
          mobile: guest.mobile,
          name: guest.name,
          email: guest.email,
          tier: guest.tier,
          totalVisits: guest.totalVisits,
          totalSpend: guest.totalSpend,
          loyaltyPoints: guest.loyaltyPoints,
          lastVisitDate: guest.lastVisitDate,
          tags: guest.tags,
        },
      }),
    );
  }
}

async function seedLeads(salesExecutiveUserId: string): Promise<void> {
  const leads: Array<{
    id: string;
    name: string;
    mobile: string;
    email: string;
    source: LeadSource;
    stage: LeadStage;
    groupSize: number;
    visitDateExpected: Date;
    budgetEstimate: string;
    notes: string;
  }> = [
    {
      id: IDS.leads.infosys,
      name: "Infosys Nagpur",
      mobile: "9898989898",
      email: "events.nagpur@infosys.com",
      source: LeadSource.REFERRAL,
      stage: LeadStage.CONTACTED,
      groupSize: 150,
      visitDateExpected: new Date("2026-05-20"),
      budgetEstimate: "175000.00",
      notes: "Corporate summer outing for associates",
    },
    {
      id: IDS.leads.dps,
      name: "DPS School trip",
      mobile: "9888877766",
      email: "admin@dpsnagpur.edu.in",
      source: LeadSource.PHONE,
      stage: LeadStage.INTERESTED,
      groupSize: 80,
      visitDateExpected: new Date("2026-06-12"),
      budgetEstimate: "92000.00",
      notes: "School summer excursion package",
    },
    {
      id: IDS.leads.sharmaWedding,
      name: "Sharma Family wedding",
      mobile: "9777766655",
      email: "sharma.family.events@gmail.com",
      source: LeadSource.WEBSITE,
      stage: LeadStage.NEW,
      groupSize: 40,
      visitDateExpected: new Date("2026-04-28"),
      budgetEstimate: "64000.00",
      notes: "Pre-wedding family event enquiry",
    },
  ];

  for (const lead of leads) {
    await upsertAndLog(`Lead - ${lead.name}`, () =>
      prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          name: lead.name,
          mobile: lead.mobile,
          email: lead.email,
          source: lead.source,
          stage: lead.stage,
          groupSize: lead.groupSize,
          visitDateExpected: lead.visitDateExpected,
          budgetEstimate: lead.budgetEstimate,
          notes: lead.notes,
          assignedTo: salesExecutiveUserId,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          id: lead.id,
          name: lead.name,
          mobile: lead.mobile,
          email: lead.email,
          source: lead.source,
          stage: lead.stage,
          groupSize: lead.groupSize,
          visitDateExpected: lead.visitDateExpected,
          budgetEstimate: lead.budgetEstimate,
          notes: lead.notes,
          assignedTo: salesExecutiveUserId,
          isDeleted: false,
        },
      }),
    );
  }
}

async function main(): Promise<void> {
  console.log("Starting AquaWorld seed...");

  await seedParkConfig();
  const { salesExecutiveUserId, priyaUserId, sureshUserId } = await seedUsersAndAccounts();
  await seedZones();
  await seedTicketTypes();
  await seedRides();
  await seedLockerData();
  await seedFoodData();
  await seedCostumeData();
  await assignSeededOwnership(priyaUserId, sureshUserId);
  await seedCoupons();
  await seedMessageTemplates();
  await seedGuestProfiles();
  await seedLeads(salesExecutiveUserId);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           AQUAWORLD SEED CREDENTIALS                 ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  ADMIN                                               ║");
  console.log("║  Email   : admin@aquaworld.com                       ║");
  console.log("║  Password: Admin@1234!                               ║");
  console.log("║  Mobile  : 9000000001                                ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  STAFF (all: Staff@1234!)                            ║");
  console.log("║  ravi@aquaworld.com   → TICKET_COUNTER               ║");
  console.log("║  priya@aquaworld.com  → RIDE_OPERATOR                ║");
  console.log("║  suresh@aquaworld.com → FB_STAFF                     ║");
  console.log("║  meena@aquaworld.com  → SECURITY_STAFF               ║");
  console.log("║  ankit@aquaworld.com  → SALES_EXECUTIVE              ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  DEV OTP (SMS + WhatsApp): 123456                    ║");
  console.log("║  Magic link: printed to console (Ethereal in dev)    ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  console.log("AquaWorld seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
