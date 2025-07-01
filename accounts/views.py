from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.contrib.auth.tokens import default_token_generator
from .models import CustomUser
from django.http import HttpResponse
from django.utils.translation import gettext as _
from django.urls import reverse

# Registro
from django.views.decorators.csrf import csrf_exempt
@csrf_exempt
def register(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        password2 = request.POST.get('password2')
        if not email or not password or not password2:
            messages.error(request, _('Email y contraseña requeridos.'))
            return render(request, 'accounts/register.html')
        if password != password2:
            messages.error(request, _('Las contraseñas no coinciden.'))
            return render(request, 'accounts/register.html')
        if CustomUser.objects.filter(email=email).exists():
            messages.error(request, _('Ya existe un usuario con ese email.'))
            return render(request, 'accounts/register.html')
        user = CustomUser.objects.create_user(email=email, password=password, is_active=False)
        # Enviar email de confirmación
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        confirm_url = request.build_absolute_uri(f"/accounts/confirm-email/{uid}/{token}/")
        subject = _('Confirma tu registro en la plataforma')
        html_message = render_to_string('accounts/email_confirmation.html', {'confirm_url': confirm_url, 'user': user})
        email_message = EmailMultiAlternatives(subject, '', settings.DEFAULT_FROM_EMAIL, [email])
        email_message.attach_alternative(html_message, "text/html")
        email_message.send()
        return render(request, 'accounts/confirm_sent.html', {'email': email})
    return render(request, 'accounts/register.html')

# Confirmación de email
def confirm_email(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None
    if user and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        messages.success(request, _('¡Email confirmado! Ya puedes iniciar sesión.'))
        return redirect('accounts:login')
    else:
        return HttpResponse(_('Enlace de confirmación inválido o expirado.'), status=400)

# Login
@csrf_exempt
def user_login(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        user = authenticate(request, email=email, password=password)
        if user is not None:
            if user.is_active:
                login(request, user)
                return redirect('dashboard')
            else:
                messages.error(request, _('Debes confirmar tu email antes de iniciar sesión.'))
        else:
            messages.error(request, _('Credenciales inválidas.'))
    return render(request, 'accounts/login.html')

# Logout
def user_logout(request):
    logout(request)
    return redirect('home')

@csrf_exempt
def password_reset_request(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        if not email:
            messages.error(request, _('Introduce tu correo electrónico.'))
            return render(request, 'accounts/password_reset_request.html')
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            messages.error(request, _('No existe ningún usuario con ese correo.'))
            return render(request, 'accounts/password_reset_request.html')
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_url = request.build_absolute_uri(reverse('accounts:password_reset_confirm', args=[uid, token]))
        subject = _('Restablece tu contraseña')
        html_message = render_to_string('accounts/password_reset_email.html', {'reset_url': reset_url, 'user': user})
        email_message = EmailMultiAlternatives(subject, '', settings.DEFAULT_FROM_EMAIL, [email])
        email_message.attach_alternative(html_message, "text/html")
        email_message.send()
        return render(request, 'accounts/password_reset_sent.html', {'email': email})
    return render(request, 'accounts/password_reset_request.html')

@csrf_exempt
def password_reset_confirm(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None
    if user is not None and default_token_generator.check_token(user, token):
        if request.method == 'POST':
            password = request.POST.get('password')
            password2 = request.POST.get('password2')
            if not password or not password2:
                messages.error(request, _('Introduce y confirma la nueva contraseña.'))
                return render(request, 'accounts/password_reset_confirm.html')
            if password != password2:
                messages.error(request, _('Las contraseñas no coinciden.'))
                return render(request, 'accounts/password_reset_confirm.html')
            user.set_password(password)
            user.save()
            messages.success(request, _('Contraseña restablecida correctamente. Ya puedes iniciar sesión.'))
            return redirect('accounts:login')
        return render(request, 'accounts/password_reset_confirm.html')
    else:
        return HttpResponse(_('El enlace de restablecimiento no es válido o ha expirado.'), status=400)
