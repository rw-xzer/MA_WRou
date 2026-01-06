from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

def login_view(request):
  """Login view"""
  if request.user.is_authenticated:
    return redirect('index')
  
  if request.method == 'POST':
    form = AuthenticationForm(request, data=request.POST)
    if form.is_valid():
      username = form.cleaned_data.get('username')
      password = form.cleaned_data.get('password')
      user = authenticate(username=username, password=password)
      if user is not None:
        login(request, user)
        return redirect('index')
  else:
    form = AuthenticationForm()
  
  return render(request, 'login.html', {'form': form})

def logout_view(request):
  """Logout view"""
  logout(request)
  return redirect('login')

def register_view(request):
  """Registration view"""
  if request.user.is_authenticated:
    return redirect('index')
  
  if request.method == 'POST':
    form = UserCreationForm(request.POST)
    if form.is_valid():
      user = form.save()
      # Automatically log in the user after registration
      login(request, user)
      return redirect('index')
  else:
    form = UserCreationForm()
  
  return render(request, 'register.html', {'form': form})

@login_required
def index(request):
  """Main dashboard view"""
  return render (request, 'index.html')

@login_required
def stats_page(request):
  """Monthly stat page - inaccessible during active study session"""
  from ..models import StudySession
  # Check if user has an active study session
  active_session = StudySession.objects.filter(user=request.user, active=True).first()
  if active_session:
    # Redirect to home page
    return redirect('index')
  
  return render(request, 'stats.html')

@login_required
def shop_page(request):
  """Shop page - inaccessible during active study session"""
  from ..models import StudySession
  # Check if user has an active study session
  active_session = StudySession.objects.filter(user=request.user, active=True).first()
  if active_session:
    return redirect('index')
  
  return render(request, 'shop.html')

