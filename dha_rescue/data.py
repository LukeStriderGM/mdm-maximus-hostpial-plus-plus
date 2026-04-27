"""
DHA RESCUE: Synthetic Data Generator
=====================================
Generates synthetic blood logistics data for the hub-and-spoke network.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)


def generate_network_nodes():
    """Generate hub-and-spoke network nodes."""
    nodes = [
        {'node_id': 'HUB_OKINAWA', 'node_name': 'Regional Blood Center (Okinawa)', 
         'node_type': 'hub', 'lat': 26.5, 'lon': 128.0, 'base_capacity': 1000},
        {'node_id': 'SPOKE_1', 'node_name': 'Marine Expeditionary Force (MEF)', 
         'node_type': 'spoke', 'lat': 26.5, 'lon': 127.5, 'base_capacity': 200},
        {'node_id': 'SPOKE_2', 'node_name': 'Expeditionary Medical Site Alpha', 
         'node_type': 'spoke', 'lat': 15.0, 'lon': 145.0, 'base_capacity': 150},
        {'node_id': 'SPOKE_3', 'node_name': 'Naval Amphibious Force', 
         'node_type': 'spoke', 'lat': 22.0, 'lon': 132.0, 'base_capacity': 180},
        {'node_id': 'SPOKE_4', 'node_name': 'Marine Corps Base Hawaii', 
         'node_type': 'spoke', 'lat': 21.3, 'lon': -157.8, 'base_capacity': 120},
        {'node_id': 'SPOKE_5', 'node_name': 'III MEF Support', 
         'node_type': 'spoke', 'lat': 33.0, 'lon': 131.0, 'base_capacity': 160},
        {'node_id': 'SPOKE_6', 'node_name': 'Afloat Element (LHD)', 
         'node_type': 'spoke', 'lat': 20.0, 'lon': 135.0, 'base_capacity': 100},
        {'node_id': 'SPOKE_7', 'node_name': 'Forward Operating Base', 
         'node_type': 'spoke', 'lat': 10.0, 'lon': 125.0, 'base_capacity': 80},
    ]
    return pd.DataFrame(nodes)


def generate_blood_products():
    """Define blood product types with shelf life."""
    products = [
        {'product_id': 'PRBC', 'product_name': 'Packed Red Blood Cells', 'shelf_hours': 42 * 24},
        {'product_id': 'PLASM', 'product_name': 'Fresh Frozen Plasma', 'shelf_hours': 365 * 24},
        {'product_id': 'PLT', 'product_name': 'Platelets', 'shelf_hours': 5 * 24},
        {'product_id': 'CRYO', 'product_name': 'Cryoprecipitate', 'shelf_hours': 365 * 24},
        {'product_id': 'WB', 'product_name': 'Whole Blood', 'shelf_hours': 35 * 24},
    ]
    return pd.DataFrame(products)


def generate_synthetic_data(num_samples=1000):
    """
    Generate synthetic blood logistics data.
    
    Features:
    - node_id: Node identifier
    - inventory_units: Current inventory count
    - expiry_hours_remaining: Hours until product expires
    - temperature_excursion_flag: 1 if temperature excursion occurred
    - transport_delay_hours: Hours of transport delay
    - route_reliability_score: 0-1 score of route reliability
    - demand_rate: Units consumed per hour
    - casualty_rate: Casualty multiplier (1-10)
    - cold_chain_health_score: 0-1 score of refrigeration health
    - backup_supply_available: 1 if backup supply exists
    """
    nodes = generate_network_nodes()
    products = generate_blood_products()
    
    data = []
    
    for _ in range(num_samples):
        # Random node selection
        node = nodes.sample(1).iloc[0]
        product = products.sample(1).iloc[0]
        
        # Base inventory (varies by node type)
        base_capacity = node['base_capacity']
        if node['node_type'] == 'hub':
            inventory_units = int(np.random.uniform(0.4, 1.0) * base_capacity)
        else:
            inventory_units = int(np.random.uniform(0.2, 0.8) * base_capacity)
        
        # Expiry hours (based on product shelf life)
        max_expiry = product['shelf_hours']
        expiry_hours_remaining = int(np.random.uniform(1, max_expiry))
        
        # Temperature excursion (more likely for platelets)
        if product['product_id'] == 'PLT':
            temperature_excursion_flag = np.random.choice([0, 1], p=[0.7, 0.3])
        else:
            temperature_excursion_flag = np.random.choice([0, 1], p=[0.85, 0.15])
        
        # Transport delay (higher for distant nodes)
        if node['node_type'] == 'hub':
            transport_delay_hours = int(np.random.uniform(0, 4))
        else:
            transport_delay_hours = int(np.random.uniform(1, 24))
        
        # Route reliability (inverse of delay)
        route_reliability_score = np.random.uniform(0.6, 1.0)
        
        # Demand rate
        demand_rate = max(1, int(np.random.uniform(0.5, 5)))
        
        # Casualty rate (1-10)
        casualty_rate = np.random.uniform(1, 10)
        
        # Cold chain health
        cold_chain_health_score = np.random.uniform(0.7, 1.0)
        
        # Backup supply
        backup_supply_available = np.random.choice([0, 1], p=[0.4, 0.6])
        
        data.append({
            'node_id': node['node_id'],
            'node_name': node['node_name'],
            'node_type': node['node_type'],
            'product_id': product['product_id'],
            'product_name': product['product_name'],
            'inventory_units': inventory_units,
            'expiry_hours_remaining': expiry_hours_remaining,
            'temperature_excursion_flag': temperature_excursion_flag,
            'transport_delay_hours': transport_delay_hours,
            'route_reliability_score': route_reliability_score,
            'demand_rate': demand_rate,
            'casualty_rate': casualty_rate,
            'cold_chain_health_score': cold_chain_health_score,
            'backup_supply_available': backup_supply_available,
        })
    
    df = pd.DataFrame(data)
    
    # Generate labels based on realistic failure conditions
    df = generate_labels(df)
    
    return df


def generate_labels(df):
    """
    Generate failure labels based on feature conditions.
    
    Failure conditions:
    - Very low days of supply (< 3 days)
    - High expiry risk (expiring within 24 hours)
    - Temperature excursion + poor cold chain
    - High transport delay + low route reliability
    - Combined risk factors
    """
    # Calculate derived features
    df['days_of_supply'] = df['inventory_units'] / df['demand_rate']
    df['expiry_risk'] = 1 / df['expiry_hours_remaining']
    df['transport_risk'] = df['transport_delay_hours'] * (1 - df['route_reliability_score'])
    df['viability_score'] = df['cold_chain_health_score'] * (1 - df['temperature_excursion_flag'])
    
    # Calculate failure probability
    failure_prob = 0.0
    
    # Days of supply factor
    failure_prob += np.where(df['days_of_supply'] < 3, 0.4, 0.0)
    failure_prob += np.where(df['days_of_supply'] < 7, 0.2, 0.0)
    
    # Expiry factor
    failure_prob += np.where(df['expiry_hours_remaining'] < 24, 0.3, 0.0)
    failure_prob += np.where(df['expiry_hours_remaining'] < 72, 0.15, 0.0)
    
    # Temperature excursion factor
    failure_prob += np.where(df['temperature_excursion_flag'] == 1, 0.2, 0.0)
    failure_prob += np.where((df['temperature_excursion_flag'] == 1) & (df['cold_chain_health_score'] < 0.8), 0.15, 0.0)
    
    # Transport factor
    failure_prob += np.where(df['transport_risk'] > 5, 0.2, 0.0)
    failure_prob += np.where(df['transport_delay_hours'] > 12, 0.15, 0.0)
    
    # Backup supply reduces failure risk
    failure_prob -= df['backup_supply_available'] * 0.1
    
    # Cap probability
    failure_prob = np.clip(failure_prob, 0, 1)
    
    # Generate binary failure label
    df['failure'] = (np.random.random(len(df)) < failure_prob).astype(int)
    
    # Generate time_to_failure (in hours)
    # If failure=1, time_to_failure is based on days of supply and risks
    # If failure=0, time_to_failure is high (no failure expected)
    df['time_to_failure'] = np.where(
        df['failure'] == 1,
        np.clip(df['days_of_supply'] * 24 * np.random.uniform(0.5, 1.5), 1, 500),
        np.clip(df['days_of_supply'] * 24 * np.random.uniform(1.5, 3), 100, 2000)
    ).astype(int)
    
    return df


def get_node_summary(df):
    """Generate summary statistics per node."""
    summary = df.groupby('node_id').agg({
        'inventory_units': 'mean',
        'days_of_supply': 'mean',
        'failure': 'mean',
        'time_to_failure': 'mean',
        'cold_chain_health_score': 'mean',
        'transport_delay_hours': 'mean'
    }).round(2)
    
    summary['failure_rate'] = (summary['failure'] * 100).round(1)
    summary['risk_level'] = pd.cut(
        summary['failure'],
        bins=[0, 0.2, 0.5, 1.0],
        labels=['LOW', 'MEDIUM', 'HIGH']
    )
    
    return summary


if __name__ == '__main__':
    # Generate data
    df = generate_synthetic_data(1000)
    print(f"Generated {len(df)} samples")
    print(f"\nColumns: {list(df.columns)}")
    print(f"\nFailure distribution:\n{df['failure'].value_counts()}")
    print(f"\nNode summary:\n{get_node_summary(df)}")