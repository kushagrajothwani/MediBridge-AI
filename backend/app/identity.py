import secrets


def _luhn_check_digit(digits: str) -> str:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return str((10 - total % 10) % 10)


def generate_mb_id() -> str:
    """Example: MB-4829-1073-5561. Random, so it reveals nothing about patient count."""
    body = "".join(str(secrets.randbelow(10)) for _ in range(11))
    raw = body + _luhn_check_digit(body)
    return f"MB-{raw[:4]}-{raw[4:8]}-{raw[8:]}"