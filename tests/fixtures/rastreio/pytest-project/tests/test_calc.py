from app.calc import add, divide


def test_add_sums_two_numbers():
    assert add(1, 2) == 3


def test_divide_by_zero_raises():
    try:
        divide(1, 0)
    except ValueError:
        return
    raise AssertionError("expected ValueError")
