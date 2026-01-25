import pandas as pd
import json

def debug_xlsx(file_path):
    xl = pd.ExcelFile(file_path)
    for sheet in xl.sheet_names:
        df = pd.read_excel(file_path, sheet_name=sheet)
        print(f"\n--- {sheet} ---")
        print(f"Columns: {df.columns.tolist()}")
        print("First Row Example:")
        print(df.iloc[0].to_dict())

if __name__ == "__main__":
    debug_xlsx("Srila Prabhupad Vani.xlsx")
