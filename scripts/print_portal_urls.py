#!/usr/bin/env python3
"""Печатает адреса портала в локальной сети (ПК по кабелю + ноут по Wi‑Fi на одном роутере)."""

from __future__ import annotations

import os
import socket
import sys


def _lan_ipv4_addresses() -> list[str]:
    found: set[str] = set()

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                found.add(ip)
    except OSError:
        pass

    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        if ip and not ip.startswith("127."):
            found.add(ip)
    except OSError:
        pass
    finally:
        probe.close()

    return sorted(found)


def main() -> int:
    port = int(os.environ.get("PORT", "8080"))
    ips = _lan_ipv4_addresses()

    print("")
    print("=== Школьный портал — один сервер для всех устройств в Wi‑Fi ===")
    print(f"На этом ПК:     http://127.0.0.1:{port}")
    if ips:
        print("С телефона/ноута в той же Wi‑Fi (откройте в браузере):")
        for ip in ips:
            print(f"  → http://{ip}:{port}")
    else:
        print("Локальный IP не определён — узнайте IPv4 в ipconfig и откройте http://<IP>:{port}".format(port=port))
    print("")
    print("Сервер слушает 0.0.0.0 — ноут по Wi‑Fi и ПК по кабелю используют ОДИН этот процесс.")
    print("Если ноут не открывает сайт: разрешите порт", port, "в брандмауэре Windows.")
    print("")
    return 0


if __name__ == "__main__":
    sys.exit(main())
