<!-- CRITICAL -->
# Provisioning Runbook (Hot Aisle MI300X)

## Current VM (2026-02-08)
- VM name: `enc1-gpuvm002`
- Public IP: `23.183.40.67`
- SSH: `ssh hotaisle@23.183.40.67`
- GPU: `AMD Instinct MI300X VF` (`gfx942`)
- ROCm: `7.1.1`

## Cost / Billing
- Hourly: `$1.99/hour` for `1x MI300X VM` (as shown in Hot Aisle provisioning UI)
- Minimum charge: `$0.03` (applied immediately)
- Billing continues while powered off. You must delete the VM to stop billing.

## Safe Access Pattern (Recommended)
The VM currently blocks incoming traffic except SSH (UFW default deny). Use SSH port forwarding instead of opening ports during bring-up.

Example:
```bash
ssh -N -L 18080:127.0.0.1:8080 hotaisle@23.183.40.67
```
Then access controller at `http://127.0.0.1:18080`.

## Verify ROCm + GPU Tooling
```bash
amd-smi version
rocm-smi --showproductname --showdriverversion --showmeminfo vram
rocminfo | head
hipcc --version
cat /opt/rocm/.info/version
```

## Install Bun (Controller Runtime)
Prereq:
```bash
sudo apt-get update -y
sudo apt-get install -y unzip
```

Install:
```bash
curl -fsSL https://bun.sh/install | bash
~/.bun/bin/bun --version
```

## Clone + Start Controller
```bash
cd ~
git clone https://github.com/0xSero/vllm-studio.git
cd vllm-studio/controller
~/.bun/bin/bun install
~/.bun/bin/bun run typecheck
~/.bun/bin/bun test

# Start (simple bring-up; replace with systemd later)
nohup ~/.bun/bin/bun run start > ~/vllm-studio-controller.log 2>&1 & echo $!
curl -sS http://127.0.0.1:8080/health
```

## Notes / Follow-ups
- Node is not installed on the VM; keep frontend dev local for now and point it to the controller via SSH tunnel.
- Next steps in workpack:
  - Implement ROCm telemetry (`amd-smi`) so `/gpus` returns MI300X.
  - Add ROCm/HIP/Torch visibility to `/config`.
  - Add Rock-Em ServiceManager + GPU lease.
