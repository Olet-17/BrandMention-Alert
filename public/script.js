// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    console.log('🔗 Navigation clicked:', this.getAttribute('href'));
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Scroll to functions
function scrollToDemo() {
  console.log('🎯 Scrolling to demo section');
  document.getElementById("demo").scrollIntoView({ behavior: "smooth" });
}

function scrollToDocs() {
  console.log('📚 Scrolling to docs section');
  document.getElementById("docs").scrollIntoView({ behavior: "smooth" });
}

// API Test Function
async function testAPI() {
  console.log('🔘 ========== TEST API BUTTON CLICKED ==========');
  
  // Debug: Check if elements exist
  const keywordInput = document.getElementById("keywordInput");
  const limitInput = document.getElementById("limitInput");
  const resultsDiv = document.getElementById("results");
  const loadingDiv = document.getElementById("loading");

  console.log('📝 Input elements found:', {
    keywordInput: !!keywordInput,
    limitInput: !!limitInput,
    resultsDiv: !!resultsDiv,
    loadingDiv: !!loadingDiv
  });

  if (!keywordInput || !limitInput) {
    console.error('❌ CRITICAL: Input elements not found!');
    alert('Page not loaded properly. Please refresh.');
    return;
  }

  const keyword = keywordInput.value.trim();
  const limit = limitInput.value;

  console.log('📊 User input values:', {
    keyword: keyword,
    limit: limit
  });

  if (!keyword) {
    console.warn('⚠️ No keyword entered');
    alert("Please enter a brand name");
    return;
  }

  // Show loading
  console.log('🔄 Showing loading state...');
  loadingDiv.classList.remove("hidden");
  resultsDiv.innerHTML = "";

  try {
    const apiUrl = `/api/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    console.log('🌐 Making API request to:', apiUrl);
    
    // Use current API key or fallback to test key
    const apiKey = window.currentApiKey || 'test-key-123';
    console.log('🔑 Using API Key:', apiKey);

    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: {
        "X-API-Key": apiKey,
      },
    });
    const requestTime = Date.now() - startTime;

    console.log('📡 API Response received:', {
      status: response.status,
      statusText: response.statusText,
      responseTime: `${requestTime}ms`,
      ok: response.ok
    });

    const data = await response.json();
    console.log('✅ API Data received:', data);

    if (!response.ok) {
      console.error('❌ API Error response:', data);
      throw new Error(data.details || data.error || "API request failed");
    }

    console.log('🎉 API Success! Processing results...');
    // Display formatted results
    displayResults(data);

  } catch (error) {
    console.error('💥 API Request failed:', error);
    resultsDiv.innerHTML = `
      <div style="color: #ef4444; background: #fef2f2; padding: 1rem; border-radius: 6px;">
        <strong>Error:</strong> ${error.message}
        <br><small>Check browser console for detailed logs</small>
      </div>
    `;
  } finally {
    console.log('🏁 Hiding loading state');
    loadingDiv.classList.add("hidden");
  }
}

function displayResults(data) {
  console.log('🖼️ Displaying results in UI');
  const resultsDiv = document.getElementById("results");

  if (!data.mentions || data.mentions.length === 0) {
    console.log('📭 No mentions found for keyword:', data.keyword);
    resultsDiv.innerHTML = `
      <div style="text-align: center; color: #6b7280; padding: 2rem;">
        No mentions found for "${data.keyword}". Try a different brand name.
        <br><small>Try: Tesla, Microsoft, Apple, Google, etc.</small>
      </div>
    `;
    return;
  }

  console.log(`📊 Displaying ${data.mentions.length} mentions`);
  
  let html = `
    <div style="margin-bottom: 1rem; color: #059669; font-weight: 600;">
      Found ${data.totalResults} mentions for "${data.keyword}"
      <br><small style="font-weight: normal; color: #6b7280;">Source: ${data.source || 'Reddit'}</small>
    </div>
  `;

  data.mentions.forEach((mention, index) => {
    console.log(`📄 Processing mention ${index + 1}:`, {
      id: mention.id,
      platform: mention.platform,
      sentiment: mention.sentiment,
      author: mention.author
    });

    const sentimentColor =
      {
        positive: "#10b981",
        negative: "#ef4444",
        neutral: "#6b7280",
      }[mention.sentiment] || "#6b7280";

    // Ensure content is properly formatted
    const displayContent = mention.content 
      ? (mention.content.length > 200 
          ? mention.content.substring(0, 200) + "..." 
          : mention.content)
      : "No content available";

    const displayTitle = mention.title 
      ? (mention.title.length > 100 
          ? mention.title.substring(0, 100) + "..." 
          : mention.title)
      : (mention.content 
          ? mention.content.substring(0, 80) + "..." 
          : "No title");

    html += `
      <div style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
        background: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <strong style="color: #1f2937; display: block; margin-bottom: 0.25rem; line-height: 1.4;">
              ${displayTitle}
            </strong>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
              by ${mention.author || 'Unknown'} in ${mention.source || 'Unknown'}
            </div>
          </div>
          <span style="
            background: ${sentimentColor};
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            white-space: nowrap;
            height: fit-content;
          ">
            ${mention.sentiment} (${(mention.confidence * 100).toFixed(0)}%)
          </span>
        </div>
        
        <div style="color: #4b5563; margin-bottom: 0.75rem; line-height: 1.5; font-size: 0.9rem;">
          ${displayContent}
        </div>
        
        <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: #6b7280; flex-wrap: wrap; align-items: center;">
          <span title="Upvotes">👍 ${mention.metadata?.upvotes || 0}</span>
          <span title="Comments">💬 ${mention.metadata?.comments || 0}</span>
          <span title="Post date">🕒 ${new Date(mention.timestamp).toLocaleDateString()}</span>
          <a href="${mention.url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">
            🔗 View Original
          </a>
        </div>
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
  console.log('✅ Results displayed successfully');
}

// Signup functionality
async function signupUser(event) {
  if (event) {
    event.preventDefault(); // Prevent form submission
    event.stopPropagation(); // Stop event bubbling
  }
  
  console.log('📝 Starting signup process...');
  
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const company = document.getElementById("signupCompany").value.trim();
  const signupButton = document.getElementById("signupButton");
  const resultDiv = document.getElementById("signupResult");
  
  // Clear any previous results
  resultDiv.innerHTML = '';
  
  // Basic validation
  if (!name || !email) {
    showSignupResult('error', 'Please fill in all required fields (name and email)');
    return false;
  }
  
  if (!isValidEmail(email)) {
    showSignupResult('error', 'Please enter a valid email address');
    return false;
  }
  
  // Show loading state
  const originalText = signupButton.innerHTML;
  signupButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating your API key...';
  signupButton.disabled = true;
  
  try {
    console.log('📨 Sending signup request...', { name, email, company });
    
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name: name,
        email: email,
        company: company 
      })
    });
    
    const data = await response.json();
    console.log('📬 Signup response:', data);
    
    if (response.ok && data.success) {
      console.log('✅ Signup successful!');
      showSignupResult('success', data);
      // Clear form
      document.getElementById("signupForm").reset();
    } else {
      throw new Error(data.details || data.error || 'Signup failed');
    }
    
  } catch (error) {
    console.error('❌ Signup error:', error);
    showSignupResult('error', error.message);
  } finally {
    // Reset button
    signupButton.innerHTML = originalText;
    signupButton.disabled = false;
  }
  
  return false;
}

function showSignupResult(type, data) {
  const resultDiv = document.getElementById("signupResult");
  
  if (type === 'success') {
    resultDiv.innerHTML = `
      <div class="signup-success">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-check-circle"></i> Welcome to BrandMention Alert!
        </h4>
        <p>Your API key has been created successfully. Here's your key:</p>
        <div class="api-key-display">${data.apiKey}</div>
        <p><strong>Usage:</strong> ${data.usage.limit} free searches per month during beta</p>
        <div class="api-key-actions">
          <button onclick="copyToClipboard('${data.apiKey}')" class="btn-primary">
            <i class="fas fa-copy"></i> Copy API Key
          </button>
          <button onclick="testWithNewKey('${data.apiKey}')" class="btn-secondary">
            <i class="fas fa-play"></i> Test API
          </button>
        </div>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #a7f3d0;">
          <strong>Next steps:</strong>
          <ul style="margin: 0.5rem 0 0 1rem;">
            <li>Use your API key in the X-API-Key header</li>
            <li>Check the documentation for examples</li>
            <li>Start monitoring your brand!</li>
          </ul>
        </div>
      </div>
    `;
    
    // Scroll to results
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
  } else {
    resultDiv.innerHTML = `
      <div class="signup-error">
        <h4 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fas fa-exclamation-triangle"></i> Signup Failed
        </h4>
        <p style="margin: 0;">${data}</p>
      </div>
    `;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary success message
    const buttons = document.querySelectorAll('.btn-primary');
    buttons.forEach(button => {
      if (button.textContent.includes('Copy API Key')) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.background = '#10b981';
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '';
        }, 2000);
      }
    });
    
    console.log('📋 API key copied to clipboard');
    showToast('API key copied to clipboard!', 'success');
  }).catch(err => {
    console.error('❌ Failed to copy:', err);
    showToast('Failed to copy API key', 'error');
  });
}

function testWithNewKey(apiKey) {
  console.log('🔑 Testing with new API key:', apiKey);
  // Set the keyword input and trigger test
  document.getElementById("keywordInput").value = "Tesla";
  // Store the API key for the test
  window.currentApiKey = apiKey;
  // Scroll to demo and test
  scrollToDemo();
  setTimeout(() => testAPI(), 500);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 6px;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Enhanced event listeners for better debugging
function initializeEventListeners() {
  console.log('🎛️ Initializing event listeners...');
  
  // Test API button
  const testButton = document.getElementById('testApiButton');
  if (testButton) {
    testButton.addEventListener('click', testAPI);
    console.log('✅ Test API button event listener added');
  } else {
    console.error('❌ Test API button not found!');
  }

  // Signup form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', signupUser);
    console.log('✅ Signup form event listener added');
  } else {
    console.error('❌ Signup form not found!');
  }

  // Demo scroll buttons
  const demoScrollBtn = document.querySelector('.demo-scroll-btn');
  if (demoScrollBtn) {
    demoScrollBtn.addEventListener('click', scrollToDemo);
    console.log('✅ Demo scroll button event listener added');
  }

  const docsScrollBtn = document.querySelector('.docs-scroll-btn');
  if (docsScrollBtn) {
    docsScrollBtn.addEventListener('click', scrollToDocs);
    console.log('✅ Docs scroll button event listener added');
  }

  // Navigation links
  const demoLink = document.querySelector('.demo-link');
  if (demoLink) {
    demoLink.addEventListener('click', scrollToDemo);
  }

  const docsLink = document.querySelector('.docs-link');
  if (docsLink) {
    docsLink.addEventListener('click', scrollToDocs);
  }

  // Enter key support in input field
  const keywordInput = document.getElementById("keywordInput");
  if (keywordInput) {
    keywordInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        console.log('↵ Enter key pressed in search input');
        testAPI();
      }
    });
    console.log('✅ Enter key listener added to search input');
  }

  // Input change tracking for debugging
  if (keywordInput) {
    keywordInput.addEventListener('input', function(e) {
      console.log('⌨️ Input changed:', e.target.value);
    });
  }
}

// Auto-test on page load for demo (with better debugging)
document.addEventListener("DOMContentLoaded", function () {
  console.log('🚀 ========== PAGE LOADED ==========');
  console.log('📄 DOM fully loaded and parsed');
  
  // Initialize all event listeners
  initializeEventListeners();

  // Check if we're on the demo section
  const urlParams = new URLSearchParams(window.location.search);
  const autoTest = urlParams.get('autoTest');
  
  if (autoTest !== 'false') {
    console.log('⚡ Auto-test triggered');
    console.log('⏰ Waiting 1 second before auto-test...');
    
    // Test the API after a short delay to show the loading state
    setTimeout(() => {
      console.log('🔄 Starting auto-test...');
      testAPI();
    }, 1000);
  } else {
    console.log('⏸️ Auto-test disabled via URL parameter');
  }
});

// Add some interactive effects
document.addEventListener("DOMContentLoaded", function () {
  console.log('🎨 Initializing animations...');
  
  // Add scroll animation to features
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        console.log('✨ Animating element into view:', entry.target);
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  // Observe feature cards
  const featureCards = document.querySelectorAll(".feature-card");
  console.log(`🎯 Found ${featureCards.length} feature cards to animate`);
  
  featureCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    card.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(card);
  });

  // Add click tracking for analytics
  document.querySelectorAll('button, a[href^="#"]').forEach(element => {
    element.addEventListener('click', function() {
      console.log('🖱️ Click tracked:', this.textContent || this.innerText);
    });
  });
});

// Utility function to test API manually from console
window.debugAPI = function(keyword = "Tesla", limit = 3) {
  console.log('🔧 Manual API test called from console');
  document.getElementById("keywordInput").value = keyword;
  document.getElementById("limitInput").value = limit;
  testAPI();
};


// Export functions for global access
window.testAPI = testAPI;
window.scrollToDemo = scrollToDemo;
window.scrollToDocs = scrollToDocs;
window.signupUser = signupUser;
window.copyToClipboard = copyToClipboard;

console.log('🎉 BrandMention Alert JavaScript loaded successfully!');
console.log('💡 Tips:');
console.log('   - Use debugAPI("YourBrand") in console to test manually');
console.log('   - Add ?autoTest=false to URL to disable auto-test');
console.log('   - Check network tab for API request details');
console.log('   - Fill out the signup form to get your own API key!');




// Documentation page tabs
const exampleTabs = document.querySelectorAll('.example-tab');
const examplePanes = document.querySelectorAll('.example-pane');

if (exampleTabs.length > 0) {
    exampleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Update active tab
            exampleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding pane
            examplePanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === targetTab) {
                    pane.classList.add('active');
                }
            });
        });
    });
}