"""
Script to compare and summarize ID occurrences between two datasets:
- publications_only_IPBLN.csv
- impact_only_IPBLN_clean.csv

Outputs:
- Number of unique IDs
- Counts of IDs found in both files
- Number of duplicates per file
- Examples of IDs duplicated in both sources
"""

import pandas as pd

# Load both input CSV files
items_df = pd.read_csv('data/data/IPBLN/csv/items_IPBLN.csv', sep=',', dtype=str)
impact_df = pd.read_csv('data/data/IPBLN/csv/impact_IPBLN.csv', sep=',', dtype=str)

# Count occurrences of id_publicacion in each file
items_counts = items_df['id_publicacion'].value_counts()
impact_counts = impact_df['id_publicacion'].value_counts()

# Combine all unique publication IDs
all_ids = set(items_counts.index).union(set(impact_counts.index))

# Build summary DataFrame
summary = pd.DataFrame(index=sorted(list(all_ids)))
summary['items_count'] = summary.index.map(items_counts).fillna(0).astype(int)
summary['impact_count'] = summary.index.map(impact_counts).fillna(0).astype(int)

# Add boolean indicators
summary['duplicated_in_items'] = summary['items_count'] > 1
summary['duplicated_in_impact'] = summary['impact_count'] > 1
summary['exists_in_both'] = (summary['items_count'] > 0) & (summary['impact_count'] > 0)

# Summary statistics
print("\n📊 Summary statistics:")
print(f"📁 Publications file: {items_df.shape[0]} rows")
print(f"📁 Impact file: {impact_df.shape[0]} rows")
print(f"🔢 Total unique IDs: {len(summary)}")
print(f"✅ IDs present in both files: {summary['exists_in_both'].sum()}")
print(f"♻️ Duplicates in publications file: {summary['duplicated_in_items'].sum()}")
print(f"♻️ Duplicates in impact file: {summary['duplicated_in_impact'].sum()}")

# Show sample of duplicated IDs in both files
print("\n📌 Example of IDs duplicated in both files:")
print(summary[(summary['duplicated_in_items']) & (summary['duplicated_in_impact'])].head())