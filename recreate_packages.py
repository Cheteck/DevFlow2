import json
import os

with open("node_modules/.old_modules-860d35dbd5580e5c/.pnpm-workspace-state-v1.json", "r") as f:
    data = json.load(f)

for path, info in data["projects"].items():
    if path == "/app/applet":
        continue
    
    # Convert absolute path to relative path from root
    rel_path = path.replace("/app/applet/", "")
    
    pkg_json_path = os.path.join(rel_path, "package.json")
    
    if not os.path.exists(pkg_json_path):
        print(f"Creating {pkg_json_path}")
        
        # Determine main file
        main_file = "src/index.ts"
        
        pkg_content = {
            "name": info["name"],
            "version": info["version"],
            "main": f"./{main_file}",
            "types": f"./{main_file}"
        }
        
        os.makedirs(os.path.dirname(pkg_json_path), exist_ok=True)
        with open(pkg_json_path, "w") as pf:
            json.dump(pkg_content, pf, indent=2)
            
        # Create src/index.ts if it doesn't exist
        src_path = os.path.join(rel_path, "src")
        os.makedirs(src_path, exist_ok=True)
        index_ts_path = os.path.join(src_path, "index.ts")
        if not os.path.exists(index_ts_path):
            with open(index_ts_path, "w") as tsf:
                tsf.write("export const Placeholder = {};\n")
