from django.shortcuts import render
import templates

def index(request):
  return render(request, 'index.html')