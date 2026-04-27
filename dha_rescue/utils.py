"""
DHA RESCUE: Feature Engineering and Recommendations
=====================================================
Utility functions for feature engineering and generating actionable recommendations.
"""

import pandas as pd
import numpy as np


def engineer_features(df):
    """
    Create engineered features for ML models.
    
    Features created:
    - days_of_supply: inventory_units / demand_rate
    - expiry_risk: 1 / expiry_hours_remaining
    - transport_risk: transport_delay_hours * (1 - route_reliability_score)
    - viability_score: cold_chain_health_score * (1 - temperature_excursion_flag)
    - risk_composite: Combined risk score
    """
    df = df.copy()
    
    # Days of supply
    df['days_of_supply'] = df['inventory_units'] / df['demand_rate']
    
    # Expiry risk (higher = more risk)
    df['expiry_risk'] = 1 / df['expiry_hours_remaining']
    
    # Transport risk
    df['transport_risk'] = df['transport_delay_hours'] * (1 - df['route_reliability_score'])
    
    # Viability score (higher = better)
    df['viability_score'] = df['cold_chain_health_score'] * (1 - df['temperature_excursion_flag'])
    
    # Composite risk score
    df['risk_composite'] = (
        (1 / df['days_of_supply'].clip(upper=30)) * 30 +  # Inventory risk
        df['expiry_risk'] * 100 +  # Expiry risk
        df['transport_risk'] * 10 +  # Transport risk
        (1 - df['viability_score']) * 50  # Viability risk
    )
    
    # Normalize risk composite to 0-100
    df['risk_composite'] = df['risk_composite'].clip(0, 100)
    
    return df


def get_feature_columns():
    """Return list of features for ML models."""
    return [
        'inventory_units',
        'expiry_hours_remaining',
        'temperature_excursion_flag',
        'transport_delay_hours',
        'route_reliability_score',
        'demand_rate',
        'casualty_rate',
        'cold_chain_health_score',
        'backup_supply_available',
        'days_of_supply',
        'expiry_risk',
        'transport_risk',
        'viability_score',
        'risk_composite'
    ]


def generate_recommendations(row):
    """
    Generate rule-based recommendations based on node risk factors.
    
    Returns list of actionable recommendations.
    """
    recommendations = []
    
    # Check days of supply
    if row.get('days_of_supply', 999) < 3:
        recommendations.append({
            'action': 'URGENT: Reorder inventory',
            'priority': 'CRITICAL',
            'reason': f"Days of supply: {row.get('days_of_supply', 0):.1f} (below 3-day threshold)",
            'impact': 'Prevents immediate stock-out'
        })
    elif row.get('days_of_supply', 999) < 7:
        recommendations.append({
            'action': 'Increase reorder quantity',
            'priority': 'HIGH',
            'reason': f"Days of supply: {row.get('days_of_supply', 0):.1f} (below 7-day threshold)",
            'impact': 'Builds buffer stock'
        })
    
    # Check expiry risk
    if row.get('expiry_hours_remaining', 999) < 24:
        recommendations.append({
            'action': 'Use expiring inventory immediately',
            'priority': 'CRITICAL',
            'reason': f"Product expires in {row.get('expiry_hours_remaining', 0)} hours",
            'impact': 'Prevents waste'
        })
    elif row.get('expiry_hours_remaining', 999) < 72:
        recommendations.append({
            'action': 'Prioritize expiring inventory for distribution',
            'priority': 'HIGH',
            'reason': f"Product expires in {row.get('expiry_hours_remaining', 0)} hours",
            'impact': 'Reduces waste risk'
        })
    
    # Check temperature excursion
    if row.get('temperature_excursion_flag', 0) == 1:
        recommendations.append({
            'action': 'Inspect cold chain equipment',
            'priority': 'CRITICAL',
            'reason': 'Temperature excursion detected',
            'impact': 'Prevents product spoilage'
        })
        recommendations.append({
            'action': 'Quarantine affected inventory for quality check',
            'priority': 'HIGH',
            'reason': 'Temperature excursion may have compromised product',
            'impact': 'Ensures patient safety'
        })
    
    # Check transport risk
    if row.get('transport_risk', 0) > 5:
        recommendations.append({
            'action': 'Reroute supply through alternative transport',
            'priority': 'HIGH',
            'reason': f"Transport risk score: {row.get('transport_risk', 0):.1f}",
            'impact': 'Reduces delivery delay'
        })
    elif row.get('transport_delay_hours', 0) > 12:
        recommendations.append({
            'action': 'Increase transport priority',
            'priority': 'MEDIUM',
            'reason': f"Transport delay: {row.get('transport_delay_hours', 0)} hours",
            'impact': 'Faster delivery'
        })
    
    # Check cold chain health
    if row.get('cold_chain_health_score', 1) < 0.8:
        recommendations.append({
            'action': 'Service refrigeration equipment',
            'priority': 'HIGH',
            'reason': f"Cold chain health: {row.get('cold_chain_health_score', 0):.2f}",
            'impact': 'Maintains product viability'
        })
    
    # Check backup supply
    if row.get('backup_supply_available', 0) == 0 and row.get('days_of_supply', 999) < 7:
        recommendations.append({
            'action': 'Activate backup supply agreement',
            'priority': 'HIGH',
            'reason': 'No backup supply available with low days of supply',
            'impact': 'Provides emergency stock'
        })
    
    # Check casualty rate impact
    if row.get('casualty_rate', 1) > 5:
        recommendations.append({
            'action': 'Pre-position additional inventory',
            'priority': 'MEDIUM',
            'reason': f"Elevated casualty rate: {row.get('casualty_rate', 0):.1f}x",
            'impact': 'Prepares for increased demand'
        })
    
    # If no issues, add positive recommendation
    if not recommendations:
        recommendations.append({
            'action': 'Maintain current operations',
            'priority': 'LOW',
            'reason': 'All risk factors within acceptable limits',
            'impact': 'Continues normal operations'
        })
    
    return recommendations


def get_risk_level(failure_prob):
    """Convert failure probability to risk level."""
    if failure_prob < 0.2:
        return 'LOW'
    elif failure_prob < 0.5:
        return 'MEDIUM'
    else:
        return 'HIGH'


def get_risk_color(risk_level):
    """Return color for risk level."""
    colors = {
        'LOW': '#28a745',      # Green
        'MEDIUM': '#ffc107',   # Yellow
        'HIGH': '#dc3545',     # Red
        'CRITICAL': '#dc3545'  # Red
    }
    return colors.get(risk_level, '#6c757d')


def format_recommendations_table(recommendations):
    """Format recommendations as a DataFrame."""
    if not recommendations:
        return pd.DataFrame(columns=['Action', 'Priority', 'Reason', 'Impact'])
    
    return pd.DataFrame(recommendations)


def calculate_confidence(prediction, feature_importance):
    """Calculate confidence score for prediction."""
    # Simple confidence based on prediction certainty and feature agreement
    base_confidence = 0.7
    
    # Adjust based on feature importance spread
    if len(feature_importance) > 0:
        importance_variance = np.var(list(feature_importance.values()))
        adjustment = min(importance_variance * 0.1, 0.2)
        base_confidence += adjustment
    
    return min(base_confidence, 0.95)


if __name__ == '__main__':
    # Test with sample data
    from data import generate_synthetic_data
    
    df = generate_synthetic_data(100)
    df = engineer_features(df)
    
    print("Engineered features:")
    print(df[['node_id', 'days_of_supply', 'expiry_risk', 'transport_risk', 'viability_score', 'risk_composite']].head())
    
    print("\nSample recommendations:")
    recs = generate_recommendations(df.iloc[0])
    for rec in recs:
        print(f"  [{rec['priority']}] {rec['action']}")