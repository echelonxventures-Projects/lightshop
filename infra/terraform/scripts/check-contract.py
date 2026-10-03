#!/usr/bin/env python3
"""Fail if any cell implementation drifts from the contract (variables + outputs) or an env root misses a variable."""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
names = lambda text, kind: set(re.findall(rf'^{kind} "([^"]+)"', text, re.M))
contract = (root / "contract/variables.tf").read_text()
contract_vars = names(contract, "variable")
contract_outputs = set(re.findall(r"^\| `([a-z_]+)` \|", (root / "contract/outputs.md").read_text(), re.M))

errors = []
for provider in sorted(p for p in (root / "providers").iterdir() if p.is_dir()):
    prefix = provider.name.replace("-", "_") + "_"
    text = "".join(f.read_text() for f in provider.glob("*.tf"))
    vars_ = names(text, "variable")
    outputs = names(text, "output")
    if missing := contract_vars - vars_:
        errors.append(f"{provider.name}: missing contract variables {sorted(missing)}")
    if extra := {v for v in vars_ - contract_vars if not v.startswith(prefix)}:
        errors.append(f"{provider.name}: extra variables must be prefixed '{prefix}': {sorted(extra)}")
    if (provider / "variables.tf").read_text() != contract:
        errors.append(f"{provider.name}: variables.tf must be an exact copy of contract/variables.tf")
    if outputs != contract_outputs:
        errors.append(f"{provider.name}: outputs {sorted(outputs)} != contract {sorted(contract_outputs)}")
    env = root / "envs" / provider.name
    env_vars = names("".join(f.read_text() for f in env.glob("*.tf")), "variable") if env.exists() else set()
    if env_vars != vars_:
        errors.append(f"envs/{provider.name}: variables {sorted(env_vars ^ vars_)} differ from the provider module")

print("\n".join(errors) if errors else f"cell contract OK: {len(contract_vars)} variables, {len(contract_outputs)} outputs, all providers conform")
sys.exit(1 if errors else 0)
