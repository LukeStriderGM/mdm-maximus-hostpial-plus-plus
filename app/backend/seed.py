"""
Fake data generator for Hospital++ — seeds the database with realistic
mock hubs, spokes, inventory, supply routes, demand signals, and events.

Usage:
    python seed.py                    # default: 5 hubs, 20 spokes
    python seed.py --hubs 3 --spokes 10
    SEED_HUBS=8 SEED_SPOKES=30 python seed.py
"""
import asyncio
import logging
import math
import os
import random
import uuid
from datetime import datetime, timedelta, date

from sqlalchemy import select, func
from models.database import engine, Base, async_session
from models.models import (
    Hub, Spoke, InventoryItem, InventoryEvent, DemandSignal, SupplyRoute,
    NodeType, NodeStatus, EventType, Priority, RouteStatus,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("seed")

# ---------------------------------------------------------------------------
# Reference data extracted from real DHA datasets
# ---------------------------------------------------------------------------

MILITARY_BASES = [
    ("Camp Humphreys", 36.9631, 127.0314),
    ("USNH Yokosuka", 35.2834, 139.6721),
    ("USNH Okinawa", 26.3344, 127.7700),
    ("Tripler AMC", 21.3606, -157.8858),
    ("Madigan AMC", 47.0770, -122.5780),
    ("Landstuhl RMC", 49.4369, 7.5617),
    ("BAMC San Antonio", 29.4600, -98.4500),
    ("Walter Reed NMMC", 38.9784, -77.0950),
    ("Naval Medical Center San Diego", 32.7335, -117.1538),
    ("Naval Medical Center Portsmouth", 36.8448, -76.3050),
    ("Womack AMC Ft Liberty", 35.1393, -79.0062),
    ("Blanchfield ACH Ft Campbell", 36.6610, -87.4732),
    ("William Beaumont AMC El Paso", 31.8100, -106.4200),
    ("USAF Academy Hospital", 38.9983, -104.8614),
    ("Mike O'Callaghan FMC Nellis", 36.2358, -115.0340),
    ("Kimbrough AHC Ft Meade", 39.1000, -76.7430),
    ("Evans ACH Ft Carson", 38.7370, -104.7846),
    ("Irwin ACH Ft Riley", 39.0600, -96.7850),
    ("Winn ACH Ft Stewart", 31.8600, -81.6050),
    ("Martin ACH Ft Benning", 32.3700, -84.9550),
    ("Fox AHC Redstone Arsenal", 34.6500, -86.6730),
    ("Kenner AHC Ft Lee", 37.2400, -77.3350),
    ("Raymond W. Bliss ACH Ft Huachuca", 31.5550, -110.3500),
    ("Bassett ACH Ft Wainwright", 64.8350, -147.7060),
    ("USNH Guam", 13.4443, 144.7937),
    ("USNH Rota", 36.6400, -6.3500),
    ("USNH Naples", 40.8333, 14.2000),
    ("USNH Sigonella", 37.4017, 14.9222),
    ("Brian Allgood ACH Camp Humphreys", 36.9500, 127.0200),
    ("121st CSH Seoul", 37.5665, 126.9780),
]

PRODUCT_CATALOG = [
    # (product_noun, product_type, description, manufacturer, catalog_no, unspsc, sizes, cold_chain)
    ("Glove", "Surgical", "GLOVE SRG LF PF BEAD CUF STRL CRM", "CARDINAL HEALTH", "2D72PT", "Surgical gloves", ["6", "6.5", "7", "7.5", "8", "8.5", "9"], False),
    ("Glove", "Exam", "GLOVE EXAM NTRL PF TXTRD", "ANSELL", "6034N", "Examination gloves", ["XS", "Small", "Medium", "Large", "XL"], False),
    ("Glove", "Exam", "GLOVE EXAM VINYL PF SM", "MCKESSON MEDICAL-SURGICAL", "14-136", "Examination gloves", ["Small", "Medium", "Large", "XL"], False),
    ("Glove", "Chemical Resistant", "GLOVE CHEM RESIST NITRILE HVY", "SHOWA-BEST GLOVE", "727-09", "Chemical resistant gloves", ["Medium", "Large", "XL"], False),
    ("Glove", "Protective", "GLOVE PROT NITRILE EXT CUFF", "O & M HALYARD", "55093", "Protective gloves", ["Small", "Medium", "Large"], False),
    ("Tube", "Blood Collection", "TUBE K3 EDTA PET 4ML LVN VCT", "GREINER BIO-ONE", "454021", "Vacuum blood collection tubes", ["3 mL", "4 mL", "6 mL", "10 mL"], True),
    ("Tube", "Blood Collection", "TUBE SST GEL PET 5ML GLD VCT", "BD", "367986", "Vacuum blood collection tubes", ["3.5 mL", "5 mL", "8.5 mL"], True),
    ("Tube", "Endotracheal", "TUBE ET NSL ORAL CUF STY MRPH EYE", "RUSCH", "504565", "Endotracheal tubes", ["5.5 mm", "6.0 mm", "6.5 mm", "7.0 mm", "7.5 mm", "8.0 mm", "8.5 mm"], False),
    ("Tube", "Nasogastric", "TUBE NASOGASTRIC SALEM SUMP", "COVIDIEN", "8888265024", "Nasogastric tubes", ["14 Fr", "16 Fr", "18 Fr"], False),
    ("Tube", "Tracheostomy", "TUBE TRACH CUFF DISP INNR CAN", "SMITHS MEDICAL", "76CS", "Tracheostomy tubes", ["6.0 mm", "7.0 mm", "8.0 mm"], False),
    ("Tube", "Suction", "TUBE SUCTION YANKAUER", "CARDINAL HEALTH", "8888501023", "Suction tubes", ["Standard"], False),
    ("Tube", "Centrifuge", "TUBE CENTRIFUGE PP 15ML CONE", "CORNING", "430791", "Centrifuge tubes", ["15 mL", "50 mL"], False),
    ("Tube", "Culture", "TUBE CULTURE GLASS 13X100MM", "VWR INTL", "47729-576", "Culture tubes", ["13x100 mm", "16x125 mm"], False),
    ("Tube", "Capillary", "TUBE CAPILLARY HEPARIN", "DRUMMOND SCIENTIFIC", "1-000-7500-H", "Capillary tubes", ["75 mm"], True),
    ("Tube", "Feeding", "TUBE FEEDING ENTERAL PUMP SET", "AVANOS", "0123-20", "Feeding tubes", ["12 Fr", "14 Fr"], False),
    ("Tube", "Gastrostomy", "TUBE GASTROSTOMY BALLOON", "APPLIED MEDICAL TECHNOLOGY", "G-20", "Gastrostomy tubes", ["16 Fr", "18 Fr", "20 Fr"], False),
    ("Glove", "Surgical", "GLOVE SRG POLYISOPRENE STRL", "MOLNLYCKE HEALTH CARE", "48460", "Surgical gloves", ["6.5", "7", "7.5", "8", "8.5"], False),
    ("Tube", "Blood Collection", "TUBE LITHIUM HEP PET 4ML GRN", "BD", "367884", "Vacuum blood collection tubes", ["3 mL", "4 mL", "6 mL"], True),
    ("Tube", "Urinalysis", "TUBE URINE CONICAL 12ML", "GLOBE SCIENTIFIC", "6224", "Urinalysis tubes", ["12 mL"], False),
    ("Tube", "Sedimentation Rate", "TUBE SED RATE CITRATE", "POLYMEDCO", "3002", "Sedimentation rate tubes", ["1.6 mL"], True),
]

TRANSPORT_MODES = ["ground", "rotary-wing", "fixed-wing", "maritime"]

CASUALTY_SCENARIOS = [
    "MCI - IED blast",
    "MCI - Vehicle rollover",
    "MASCAL - Forward operating base",
    "Routine resupply",
    "Surgical surge - penetrating trauma",
    "Burns mass casualty",
    "Chemical exposure response",
    "Training exercise support",
    None,
    None,
    None,  # weight toward no scenario
]


def _uid() -> str:
    return str(uuid.uuid4())


def _jitter(base: float, pct: float = 0.15) -> float:
    return base + base * random.uniform(-pct, pct)


async def seed(num_hubs: int = 5, num_spokes: int = 20):
    """Generate and insert fake data."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if data already exists
        existing = (await db.execute(select(func.count(Hub.id)))).scalar()
        if existing and existing > 0:
            logger.info("Database already has %d hubs — skipping seed. "
                        "Set SEED_FORCE=1 to re-seed.", existing)
            if not os.getenv("SEED_FORCE"):
                return

        total_bases = len(MILITARY_BASES)
        num_hubs = min(num_hubs, total_bases)
        num_spokes = min(num_spokes, total_bases - num_hubs)

        # Shuffle and split bases into hubs and spokes
        bases = random.sample(MILITARY_BASES, num_hubs + num_spokes)
        hub_bases = bases[:num_hubs]
        spoke_bases = bases[num_hubs:]

        # --- Create Hubs ---
        hubs = []
        for name, lat, lng in hub_bases:
            hub = Hub(
                id=_uid(),
                name=name,
                latitude=lat + random.uniform(-0.01, 0.01),
                longitude=lng + random.uniform(-0.01, 0.01),
                status=random.choices(
                    [NodeStatus.operational, NodeStatus.degraded, NodeStatus.offline],
                    weights=[85, 12, 3],
                )[0],
                capacity=random.randint(5000, 50000),
            )
            db.add(hub)
            hubs.append(hub)
            logger.info("Hub: %s", name)
        await db.flush()

        # --- Create Spokes ---
        spokes = []
        for i, (name, lat, lng) in enumerate(spoke_bases):
            parent = hubs[i % len(hubs)]
            spoke = Spoke(
                id=_uid(),
                name=name,
                hub_id=parent.id,
                latitude=lat + random.uniform(-0.01, 0.01),
                longitude=lng + random.uniform(-0.01, 0.01),
                status=random.choices(
                    [NodeStatus.operational, NodeStatus.degraded, NodeStatus.offline],
                    weights=[75, 18, 7],
                )[0],
            )
            db.add(spoke)
            spokes.append(spoke)
            logger.info("Spoke: %s -> Hub: %s", name, parent.name)
        await db.flush()

        all_nodes = [(h.id, NodeType.hub) for h in hubs] + [(s.id, NodeType.spoke) for s in spokes]

        # --- Create Supply Routes (each spoke to its hub) ---
        for spoke in spokes:
            parent = next(h for h in hubs if h.id == spoke.hub_id)
            dist = _haversine(parent.latitude, parent.longitude, spoke.latitude, spoke.longitude)
            mode = random.choice(TRANSPORT_MODES)
            speed_map = {"ground": 60, "rotary-wing": 220, "fixed-wing": 800, "maritime": 30}
            transit = dist / speed_map[mode]
            route = SupplyRoute(
                id=_uid(),
                hub_id=parent.id,
                spoke_id=spoke.id,
                transport_mode=mode,
                distance_km=round(dist, 1),
                transit_hours=round(transit, 2),
                status=random.choices(
                    [RouteStatus.available, RouteStatus.degraded, RouteStatus.denied],
                    weights=[80, 15, 5],
                )[0],
            )
            db.add(route)

        # --- Create Inventory Items ---
        items_created = 0
        for node_id, node_type in all_nodes:
            # Each node gets a random subset of products
            num_products = random.randint(8, len(PRODUCT_CATALOG))
            products = random.sample(PRODUCT_CATALOG, num_products)

            for noun, ptype, desc, mfr, cat, unspsc, sizes, cold in products:
                size = random.choice(sizes)
                qty = random.randint(0, 500) if node_type == NodeType.hub else random.randint(0, 120)
                threshold = max(qty // 4, 5)

                # Expiration 30-365 days out, or None
                exp = None
                if cold or random.random() < 0.4:
                    exp = date.today() + timedelta(days=random.randint(30, 365))

                item = InventoryItem(
                    id=_uid(),
                    node_id=node_id,
                    node_type=node_type,
                    product_noun=noun,
                    product_type=ptype,
                    item_description=desc,
                    manufacturer=mfr,
                    catalog_number=cat,
                    unspsc_commodity=unspsc,
                    product_size=size,
                    quantity_on_hand=qty,
                    reorder_threshold=threshold,
                    expiration_date=exp,
                    cold_chain_required=cold,
                )
                db.add(item)
                items_created += 1

        logger.info("Inventory items created: %d", items_created)

        # --- Create Inventory Events (recent history) ---
        events_created = 0
        now = datetime.utcnow()
        for node_id, node_type in all_nodes:
            num_events = random.randint(20, 80)
            for _ in range(num_events):
                product = random.choice(PRODUCT_CATALOG)
                etype = random.choices(
                    [EventType.restock, EventType.consume, EventType.transfer, EventType.expire],
                    weights=[30, 50, 15, 5],
                )[0]
                delta = random.randint(1, 50)
                if etype in (EventType.consume, EventType.expire):
                    delta = -delta

                event = InventoryEvent(
                    id=_uid(),
                    node_id=node_id,
                    node_type=node_type,
                    product_type=product[1],
                    event_type=etype,
                    quantity_delta=delta,
                    timestamp=now - timedelta(
                        days=random.randint(0, 30),
                        hours=random.randint(0, 23),
                        minutes=random.randint(0, 59),
                    ),
                )
                db.add(event)
                events_created += 1

        logger.info("Inventory events created: %d", events_created)

        # --- Create Demand Signals ---
        demands_created = 0
        for spoke in spokes:
            num_demands = random.randint(2, 10)
            for _ in range(num_demands):
                product = random.choice(PRODUCT_CATALOG)
                signal = DemandSignal(
                    id=_uid(),
                    spoke_id=spoke.id,
                    product_type=product[1],
                    quantity_needed=random.randint(5, 200),
                    priority=random.choices(
                        [Priority.routine, Priority.urgent, Priority.emergency],
                        weights=[60, 30, 10],
                    )[0],
                    casualty_scenario=random.choice(CASUALTY_SCENARIOS),
                    created_at=now - timedelta(
                        days=random.randint(0, 14),
                        hours=random.randint(0, 23),
                    ),
                )
                db.add(signal)
                demands_created += 1

        logger.info("Demand signals created: %d", demands_created)

        await db.commit()
        logger.info(
            "Seed complete: %d hubs, %d spokes, %d items, %d events, %d demands",
            len(hubs), len(spokes), items_created, events_created, demands_created,
        )


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed Hospital++ with fake data")
    parser.add_argument("--hubs", type=int, default=int(os.getenv("SEED_HUBS", "5")))
    parser.add_argument("--spokes", type=int, default=int(os.getenv("SEED_SPOKES", "20")))
    args = parser.parse_args()
    asyncio.run(seed(num_hubs=args.hubs, num_spokes=args.spokes))
