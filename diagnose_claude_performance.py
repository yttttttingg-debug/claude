#!/usr/bin/env python3
"""
Diagnose common causes of Claude desktop app / CLI slowness.

Checks:
  1. CPU usage
  2. Memory availability
  3. Network latency to Anthropic API
  4. Disk I/O
  5. Competing heavy processes
"""

import subprocess
import sys
import time

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def section(title: str) -> None:
    print(f"\n{'='*55}")
    print(f"  {title}")
    print('='*55)


# ---------------------------------------------------------------------------
# 1. CPU
# ---------------------------------------------------------------------------

def check_cpu() -> None:
    section("CPU")
    try:
        import psutil
        pct = psutil.cpu_percent(interval=1)
        count = psutil.cpu_count()
        freq = psutil.cpu_freq()
        print(f"  使用率   : {pct:.1f}%  ({count} 核心)")
        if freq:
            print(f"  頻率     : 目前 {freq.current:.0f} MHz / 最高 {freq.max:.0f} MHz")
        if pct > 80:
            print("  ⚠️  CPU 使用率過高，可能導致 Claude 回應遲緩。")
    except ImportError:
        # fallback: parse /proc/stat on Linux
        try:
            with open("/proc/stat") as f:
                line = f.readline()
            vals = list(map(int, line.split()[1:]))
            idle_before = vals[3]
            total_before = sum(vals)
            time.sleep(0.5)
            with open("/proc/stat") as f:
                line = f.readline()
            vals = list(map(int, line.split()[1:]))
            idle_after = vals[3]
            total_after = sum(vals)
            usage = 100.0 * (1 - (idle_after - idle_before) / (total_after - total_before))
            print(f"  使用率   : {usage:.1f}%")
            if usage > 80:
                print("  ⚠️  CPU 使用率過高，可能導致 Claude 回應遲緩。")
        except Exception as e:
            print(f"  無法取得 CPU 資訊: {e}")


# ---------------------------------------------------------------------------
# 2. Memory
# ---------------------------------------------------------------------------

def check_memory() -> None:
    section("記憶體 (RAM)")
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_gb = vm.total / 1024**3
        avail_gb = vm.available / 1024**3
        pct = vm.percent
        print(f"  總量     : {total_gb:.1f} GB")
        print(f"  可用     : {avail_gb:.1f} GB ({100-pct:.1f}% 空閒)")
        if avail_gb < 1.0:
            print("  ⚠️  可用記憶體不足 1 GB！Claude 可能因換頁 (swap) 而變慢。")
        elif avail_gb < 2.0:
            print("  ⚠️  可用記憶體偏低 (<2 GB)，建議關閉其他應用程式。")
    except ImportError:
        try:
            with open("/proc/meminfo") as f:
                info = {l.split(":")[0]: int(l.split()[1]) for l in f if ":" in l}
            total_gb = info.get("MemTotal", 0) / 1024**2
            avail_gb = info.get("MemAvailable", 0) / 1024**2
            print(f"  總量     : {total_gb:.1f} GB")
            print(f"  可用     : {avail_gb:.1f} GB")
            if avail_gb < 1.0:
                print("  ⚠️  可用記憶體不足 1 GB！Claude 可能因換頁 (swap) 而變慢。")
        except Exception as e:
            print(f"  無法取得記憶體資訊: {e}")


# ---------------------------------------------------------------------------
# 3. Network latency to Anthropic API
# ---------------------------------------------------------------------------

def check_network() -> None:
    section("網路延遲 (api.anthropic.com)")
    host = "api.anthropic.com"

    # Try ping first
    out = _run(["ping", "-c", "4", "-W", "3", host])
    if out:
        for line in out.splitlines():
            if "rtt" in line or "round-trip" in line or "avg" in line.lower():
                print(f"  {line.strip()}")
                if any(f in line for f in ["rtt", "round-trip", "avg"]):
                    try:
                        avg_ms = float(line.split("/")[4])
                        if avg_ms > 300:
                            print("  ⚠️  延遲過高 (>300 ms)，網路可能是 Claude 變慢的主因。")
                        elif avg_ms > 150:
                            print("  ℹ️  延遲偏高 (>150 ms)，可考慮改善網路環境。")
                        else:
                            print("  ✅ 延遲正常。")
                    except (IndexError, ValueError):
                        pass
    else:
        # curl fallback
        start = time.time()
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{time_total}", f"https://{host}"],
            capture_output=True, text=True, timeout=10
        )
        elapsed = time.time() - start
        if result.returncode == 0:
            ms = float(result.stdout) * 1000
            print(f"  HTTPS 連線時間 : {ms:.0f} ms")
            if ms > 2000:
                print("  ⚠️  連線時間過長，網路可能是主因。")
        else:
            print(f"  ⚠️  無法連線到 {host}，請確認網路設定。")


# ---------------------------------------------------------------------------
# 4. Disk I/O
# ---------------------------------------------------------------------------

def check_disk() -> None:
    section("磁碟 I/O")
    try:
        import psutil
        before = psutil.disk_io_counters()
        time.sleep(1)
        after = psutil.disk_io_counters()
        if before and after:
            read_mb = (after.read_bytes - before.read_bytes) / 1024**2
            write_mb = (after.write_bytes - before.write_bytes) / 1024**2
            print(f"  讀取速率 : {read_mb:.2f} MB/s")
            print(f"  寫入速率 : {write_mb:.2f} MB/s")
            if read_mb + write_mb > 100:
                print("  ⚠️  磁碟 I/O 負載很高，可能影響整體效能。")
    except ImportError:
        print("  (需要 psutil 才能量測磁碟 I/O)")
    except Exception as e:
        print(f"  無法取得磁碟資訊: {e}")


# ---------------------------------------------------------------------------
# 5. Heavy competing processes
# ---------------------------------------------------------------------------

def check_top_processes() -> None:
    section("CPU / 記憶體佔用最高的前 10 個行程")
    try:
        import psutil

        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                procs.append(p.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # warm up cpu_percent (first call is always 0)
        time.sleep(0.5)
        procs2 = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                procs2.append(p.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        procs2.sort(key=lambda x: (x["cpu_percent"] or 0) + (x["memory_percent"] or 0) * 5,
                    reverse=True)

        print(f"  {'PID':>7}  {'CPU%':>6}  {'MEM%':>6}  名稱")
        print(f"  {'-'*7}  {'-'*6}  {'-'*6}  {'-'*25}")
        for p in procs2[:10]:
            cpu = p["cpu_percent"] or 0
            mem = p["memory_percent"] or 0
            print(f"  {p['pid']:>7}  {cpu:>6.1f}  {mem:>6.1f}  {p['name']}")

    except ImportError:
        # fallback: ps command
        out = _run(["ps", "aux", "--sort=-%cpu"])
        lines = out.splitlines()
        print("  " + lines[0])
        for line in lines[1:11]:
            print("  " + line)
    except Exception as e:
        print(f"  無法列出行程: {e}")


# ---------------------------------------------------------------------------
# 6. Summary & suggestions
# ---------------------------------------------------------------------------

def summary() -> None:
    section("建議")
    tips = [
        "• 關閉不需要的背景應用程式，釋放 CPU 和記憶體。",
        "• 若網路延遲高，可嘗試更換 DNS (8.8.8.8 / 1.1.1.1) 或使用有線網路。",
        "• 確認 Claude 應用程式已更新到最新版本。",
        "• 若使用 Claude Code CLI，可用 `--model claude-haiku-4-5-20251001` 切換到較輕量的模型。",
        "• 若 swap 使用率高，考慮增加實體記憶體或關閉記憶體密集的程式。",
        "• 長對話 context 越大，API 回應越慢：定期 /clear 或 /compact 清除上下文。",
    ]
    for tip in tips:
        print(f"  {tip}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n🔍 Claude 電腦效能診斷工具")
    print(f"   診斷時間：{time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    check_cpu()
    check_memory()
    check_network()
    check_disk()
    check_top_processes()
    summary()

    print("\n診斷完成。\n")
