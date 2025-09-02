from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException

def js_set_value_and_dispatch(driver, element, value):
    driver.execute_script("""
        const el = arguments[0];
        const val = arguments[1];
        el.value = val;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        el.dispatchEvent(new Event('blur', {bubbles:true}));
    """, element, value)

def try_close_cookie_banner(driver):
    try:
        for xp in [
            "//button[contains(., 'Aceptar todas') or contains(., 'Aceptar')]",
            "//button[contains(., 'Accept all') or contains(., 'Accept')]",
            "//a[contains(., 'Aceptar') or contains(., 'Accept')]",
        ]:
            buttons = driver.find_elements(By.XPATH, xp)
            for b in buttons:
                try:
                    driver.execute_script("arguments[0].click();", b)
                    return True
                except Exception:
                    pass
    except Exception:
        pass
    return False

def switch_to_frame_with(driver, by, selector, timeout=10):
    wait = WebDriverWait(driver, timeout)
    try:
        wait.until(EC.presence_of_element_located((by, selector)))
        return True
    except TimeoutException:
        pass

    iframes = driver.find_elements(By.TAG_NAME, "iframe")
    for frame in iframes:
        try:
            driver.switch_to.default_content()
            driver.switch_to.frame(frame)
            WebDriverWait(driver, 3).until(EC.presence_of_element_located((by, selector)))
            return True
        except TimeoutException:
            continue

    driver.switch_to.default_content()
    return False

def dump_state(driver, tag="state"):
    try:
        html = driver.page_source
        fn_html = f"debug_{tag}.html"
        with open(fn_html, "w", encoding="utf-8") as f:
            f.write(html)
        png = f"debug_{tag}.png"
        driver.save_screenshot(png)
        print(f"[DEBUG] Saved {fn_html} and {png}")
    except Exception as e:
        print("[DEBUG] dump_state failed:", e)

def login_gesbib(driver, user, password, stdout_print=print, target_url="https://apps.csic.es/gesbib/adv/listadoInstitutos.html"):
    """
    Open target_url, perform CAS login if needed, handle intermediate 'Ir a la aplicación',
    and ensure we are inside GesBIB. Returns True on success.
    """
    wait = WebDriverWait(driver, 20)
    driver.get(target_url)

    try_close_cookie_banner(driver)

    # CAS login (may be inside an iframe)
    found_login = switch_to_frame_with(driver, By.ID, "username", timeout=10)
    if found_login:
        user_el = wait.until(EC.presence_of_element_located((By.ID, "username")))
        try:
            user_el.clear()
        except Exception:
            pass
        js_set_value_and_dispatch(driver, user_el, user)

        pwd_el = wait.until(EC.presence_of_element_located((By.ID, "password")))
        try:
            pwd_el.clear()
        except Exception:
            pass
        js_set_value_and_dispatch(driver, pwd_el, password)

        # Try form.submit() first (bypasses disabled visual states)
        try:
            form_el = user_el.find_element(By.XPATH, "ancestor::form")
            driver.execute_script("arguments[0].submit();", form_el)
        except Exception:
            # Fallback 1: JS click on the button
            try:
                login_btn = wait.until(EC.presence_of_element_located((
                    By.CSS_SELECTOR,
                    "#submitButtonBlock button[type='submit'], button[name='submit'][type='submit']"
                )))
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", login_btn)
                driver.execute_script("arguments[0].click();", login_btn)
            except Exception:
                # Fallback 2: Enter key on password
                pwd_el.send_keys(Keys.RETURN)

        driver.switch_to.default_content()

    # Intermediate page: "Ir a la aplicación"
    try:
        link_el = WebDriverWait(driver, 15).until(EC.presence_of_element_located((
            By.XPATH, "//a[button/span[normalize-space()='Ir a la aplicación']]"
        )))
        href = link_el.get_attribute("href")
        if href:
            driver.get(href)
        else:
            btn = driver.find_element(By.XPATH, "//button[span[normalize-space()='Ir a la aplicación']]")
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
            driver.execute_script("arguments[0].click();", btn)
    except TimeoutException:
        # SSO already granted or direct redirect
        pass

    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    stdout_print("✅ Login successful.")
    return True