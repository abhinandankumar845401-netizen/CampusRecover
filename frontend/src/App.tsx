
import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import "./App.css";

interface Item {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: "lost" | "found" | "claimed";
  location: string;
  date: string;
  imageUrl?: string;
  createdBy?: string;
}

interface ReportFormData {
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
}

const API_URL = "http://localhost:5000/api/items";
const AUTH_URL = "http://localhost:5000/api/auth";

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthFormData {
  name: string;
  email: string;
  password: string;
}

function getTodayDate(): string {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().split("T")[0];
}

function createEmptyForm(): ReportFormData {
  return {
    title: "",
    description: "",
    category: "",
    location: "",
    date: getTodayDate(),
  };
}

function App() {
  // Restore the saved session when the app loads.
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("campusrecover_token");
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem("campusrecover_user");
    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser) as AuthUser;
    } catch {
      localStorage.removeItem("campusrecover_user");
      localStorage.removeItem("campusrecover_token");
      return null;
    }
  });
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authFormData, setAuthFormData] = useState<AuthFormData>({
    name: "",
    email: "",
    password: "",
  });
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  // Item list and search
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // My Reports dashboard
  const [showMyReports, setShowMyReports] = useState(false);
  const [myReports, setMyReports] = useState<Item[]>([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [myReportsError, setMyReportsError] = useState("");
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Selected item details
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState("");

  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  // Report form
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportStatus, setReportStatus] = useState<"lost" | "found">("lost");
  // Remember which report action the user wanted before logging in.
  const [pendingReportStatus, setPendingReportStatus] =
    useState<"lost" | "found" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] =
    useState<ReportFormData>(createEmptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  // Create a temporary preview URL for the selected image and clean it up.
  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  // Fetch items from the Express backend.
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setError("");

        const response = await axios.get(API_URL);
        setItems(response.data.data);
      } catch (err) {
        console.error("Failed to fetch items:", err);
        setError(
          "Could not load items. Please check whether the backend is running."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Search, filter, and sort items.
  const filteredItems = items
    .filter((item) => {
      const searchableText = [
        item.title,
        item.description,
        item.category,
        item.location,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(
        search.trim().toLowerCase()
      );

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      return sortOrder === "newest"
        ? dateB - dateA
        : dateA - dateB;
    });

  // Open the report form. Reporting requires a logged-in user.
  const openReportForm = (status: "lost" | "found") => {
    if (!token) {
      setPendingReportStatus(status);
      setAuthMode("login");
      setAuthError("Please log in or create an account to continue your report.");
      setShowAuthForm(true);
      setShowReportForm(false);
      setSelectedItem(null);

      window.setTimeout(() => {
        document.getElementById("auth-form")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return;
    }

    setReportStatus(status);
    setFormError("");
    setSuccessMessage("");
    setActionError("");
    setSelectedItem(null);
    setShowReportForm(true);

    window.setTimeout(() => {
      document.getElementById("report-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  // Register or log in.
  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (authSubmitting) return;

    setAuthSubmitting(true);
    setAuthError("");

    try {
      const payload =
        authMode === "register"
          ? {
              name: authFormData.name.trim(),
              email: authFormData.email.trim().toLowerCase(),
              password: authFormData.password,
            }
          : {
              email: authFormData.email.trim().toLowerCase(),
              password: authFormData.password,
            };

      const response = await axios.post(`${AUTH_URL}/${authMode}`, payload);
      const newToken = response.data.token as string;
      const newUser = response.data.user as AuthUser;

      // Persist the session so refreshing the page does not immediately log out.
      localStorage.setItem("campusrecover_token", newToken);
      localStorage.setItem("campusrecover_user", JSON.stringify(newUser));

      setToken(newToken);
      setCurrentUser(newUser);
      setShowAuthForm(false);
      setAuthFormData({ name: "", email: "", password: "" });
      setAuthError("");

      const nextReportStatus = pendingReportStatus;
      setPendingReportStatus(null);

      if (nextReportStatus) {
        // Continue the action that brought the user to login.
        setReportStatus(nextReportStatus);
        setFormError("");
        setActionError("");
        setSelectedItem(null);
        setShowReportForm(true);
        setSuccessMessage(
          `Welcome, ${newUser.name}! You are logged in. Complete your report below.`
        );

        window.setTimeout(() => {
          document.getElementById("report-form")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      } else {
        setShowReportForm(false);
        setSuccessMessage(
          authMode === "register"
            ? `Welcome to CampusRecover, ${newUser.name}! Your account is ready.`
            : `Welcome back, ${newUser.name}! You are now logged in.`
        );

        window.setTimeout(() => {
          document.getElementById("items")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    } catch (err) {
      console.error("Authentication failed:", err);

      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setAuthError(err.response.data.message);
      } else {
        setAuthError("Could not connect to the server. Please try again.");
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("campusrecover_token");
    localStorage.removeItem("campusrecover_user");

    setToken(null);
    setCurrentUser(null);
    setShowAuthForm(false);
    setShowReportForm(false);
    setShowMyReports(false);
    setMyReports([]);
    setSelectedItem(null);
    setPendingReportStatus(null);
    setSuccessMessage("You have been logged out successfully.");
    setActionError("");
    setFormError("");

    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  // Fetch only reports owned by the currently logged-in student.
  const fetchMyReports = async () => {
    if (!token) {
      setMyReportsError("Please log in to view your reports.");
      return;
    }

    setMyReportsLoading(true);
    setMyReportsError("");

    try {
      const response = await axios.get(`${API_URL}/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMyReports(response.data.data as Item[]);
    } catch (err) {
      console.error("Failed to fetch my reports:", err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setMyReportsError(err.response.data.message);
      } else {
        setMyReportsError("Could not load your reports. Please try again.");
      }
    } finally {
      setMyReportsLoading(false);
    }
  };

  const openMyReports = async () => {
    setShowMyReports(true);
    setShowReportForm(false);
    setShowAuthForm(false);
    setSelectedItem(null);
    await fetchMyReports();
    window.setTimeout(() => {
      document.getElementById("my-reports")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const handleDeleteReport = async (item: Item) => {
    if (!token || deletingReportId) return;

    const confirmed = window.confirm(
      `Delete your report for "${item.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingReportId(item._id);
    setMyReportsError("");

    try {
      await axios.delete(`${API_URL}/${item._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMyReports((previous) => previous.filter((report) => report._id !== item._id));
      setItems((previous) => previous.filter((report) => report._id !== item._id));
      if (selectedItem?._id === item._id) setSelectedItem(null);
      setSuccessMessage(`Your report for "${item.title}" was deleted.`);
    } catch (err) {
      console.error("Failed to delete report:", err);
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setMyReportsError(err.response.data.message);
      } else {
        setMyReportsError("Could not delete this report. Please try again.");
      }
    } finally {
      setDeletingReportId(null);
    }
  };

  // Submit a new item report.
  const handleReportSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (submitting) return;

    if (!token) {
      setFormError("Please log in before submitting a report.");
      setShowReportForm(false);
      setShowAuthForm(true);
      setAuthMode("login");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setSuccessMessage("");

    try {
      // Multer expects multipart/form-data with the file field named "image".
      const payload = new FormData();
      payload.append("title", formData.title.trim());
      payload.append("description", formData.description.trim());
      payload.append("category", formData.category.trim());
      payload.append("location", formData.location.trim());
      payload.append("date", new Date(formData.date).toISOString());
      payload.append("status", reportStatus);

      if (imageFile) {
        payload.append("image", imageFile);
      }

      const response = await axios.post(API_URL, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newItem: Item = response.data.data;

      setItems((previousItems) => [newItem, ...previousItems]);
      setMyReports((previousReports) => [newItem, ...previousReports]);
      setSearch("");
      setStatusFilter("all");
      setCategoryFilter("all");
      setSortOrder("newest");
      setFormData(createEmptyForm());
      setImageFile(null);
      setShowReportForm(false);
      setSelectedItem(null);

      setSuccessMessage(
        `Your ${reportStatus} item report was submitted successfully!`
      );
    } catch (err) {
      console.error("Failed to submit report:", err);

      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setFormError(err.response.data.message);
      } else {
        setFormError(
          "Could not submit your report. Check your connection and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Update an item's status using the existing PATCH API.
  const handleMarkClaimed = async (item: Item) => {
    if (updatingStatus || item.status === "claimed") return;

    setUpdatingStatus(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const response = await axios.patch(
        `${API_URL}/${item._id}/status`,
        { status: "claimed" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedItem: Item = response.data.data;

      // Replace the old item with the updated item.
      setItems((previousItems) =>
        previousItems.map((existingItem) =>
          existingItem._id === updatedItem._id
            ? updatedItem
            : existingItem
        )
      );
      setMyReports((previousReports) =>
        previousReports.map((existingItem) =>
          existingItem._id === updatedItem._id ? updatedItem : existingItem
        )
      );

      // Keep the details view in sync only if this item is currently open.
      if (selectedItem?._id === updatedItem._id) {
        setSelectedItem(updatedItem);
      }

      setSuccessMessage("Item marked as claimed successfully!");
    } catch (err) {
      console.error("Failed to update item status:", err);

      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setActionError(err.response.data.message);
      } else {
        setActionError(
          "Could not update the item status. Please try again."
        );
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <main className="campus-app">
      {/* Navigation */}
      <nav className="navbar">
        <a
          className="brand"
          href="/"
          onClick={() => {
            setSelectedItem(null);
            setShowReportForm(false);
          }}
        >
          <span className="brand-icon">C</span>
          CampusRecover
        </a>

        <div className="nav-links">
          <a
            href="#items"
            onClick={() => {
              setSelectedItem(null);
              setShowMyReports(false);
            }}
          >
            Browse Items
          </a>
          {currentUser && (
            <button
              type="button"
              className="text-button"
              onClick={openMyReports}
            >
              My Reports
            </button>
          )}
          <a href="#how-it-works">How It Works</a>
        </div>

        <button
          type="button"
          className="nav-button"
          onClick={() => openReportForm("lost")}
        >
          + Report an Item
        </button>

        {currentUser ? (
          <div className="nav-auth">
            <div className="user-profile">
              <div className="user-avatar" aria-hidden="true">
                {currentUser.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="user-info">
                <span className="user-label">SIGNED IN</span>
                <strong>{currentUser.name}</strong>
              </div>
              <span className="online-indicator" title="Logged in" />
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
              setShowAuthForm(true);
              setShowReportForm(false);
              setPendingReportStatus(null);

              window.setTimeout(() => {
                document.getElementById("auth-form")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }, 100);
            }}
          >
            Log in
          </button>
        )}
      </nav>

      {/* Hero section */}
      <section className="hero-section">
        <span className="eyebrow">
          YOUR CAMPUS. YOUR COMMUNITY.
        </span>

        <h1>
          Lost something?
          <br />
          <span>Let's bring it back.</span>
        </h1>

        <p className="hero-description">
          A simpler way to report lost belongings and reunite
          students with the things that matter.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => openReportForm("lost")}
          >
            I Lost Something
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => openReportForm("found")}
          >
            I Found Something
          </button>
        </div>

        {/* Search box */}
        <div className="search-box">
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            placeholder="Search wallet, ID card, headphones..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search lost and found items"
          />

          {search && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSearch("")}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Authentication form */}
      {showAuthForm && (
        <section className="report-section" id="auth-form">
          <div className="report-form-container">
            <span className="eyebrow">CAMPUSRECOVER ACCOUNT</span>
            <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="report-description">
              {authMode === "login"
                ? "Log in to report items and manage your reports."
                : "Register to help reunite lost belongings with their owners."}
            </p>

            <form onSubmit={handleAuthSubmit} className="report-form">
              {authMode === "register" && (
                <>
                  <label htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    value={authFormData.name}
                    onChange={(event) =>
                      setAuthFormData({
                        ...authFormData,
                        name: event.target.value,
                      })
                    }
                  />
                </>
              )}

              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={authFormData.email}
                onChange={(event) =>
                  setAuthFormData({
                    ...authFormData,
                    email: event.target.value,
                  })
                }
              />

              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                minLength={authMode === "register" ? 8 : undefined}
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                value={authFormData.password}
                onChange={(event) =>
                  setAuthFormData({
                    ...authFormData,
                    password: event.target.value,
                  })
                }
              />

              {authError && (
                <p className="form-error" role="alert">
                  {authError}
                </p>
              )}

              <div className="report-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={authSubmitting}
                  onClick={() => {
                    setShowAuthForm(false);
                    setAuthError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={authSubmitting}
                >
                  {authSubmitting
                    ? "Please wait..."
                    : authMode === "login"
                      ? "Log in"
                      : "Create account"}
                </button>
              </div>

              <p>
                {authMode === "login"
                  ? "Don't have an account? "
                  : "Already registered? "}
                <button
                  type="button"
                  className="text-button"
                  disabled={authSubmitting}
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError("");
                  }}
                >
                  {authMode === "login" ? "Create one" : "Log in"}
                </button>
              </p>
            </form>
          </div>
        </section>
      )}

      {/* Report form */}
      {showReportForm && (
        <section className="report-section" id="report-form">
          <div className="report-form-container">
            <span className="eyebrow">CAMPUS LOST & FOUND</span>

            <h2>Report an Item</h2>

            <p className="report-description">
              Share the details so your campus community can help.
            </p>

            <form
              onSubmit={handleReportSubmit}
              className="report-form"
            >
              <label htmlFor="title">Item title</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Black wallet"
                value={formData.title}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    title: event.target.value,
                  })
                }
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                required
                minLength={5}
                maxLength={1000}
                placeholder="Describe the item and identifying details"
                value={formData.description}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    description: event.target.value,
                  })
                }
              />

              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    category: event.target.value,
                  })
                }
              >
                <option value="">Choose a category</option>
                <option value="Electronics">Electronics</option>
                <option value="ID Card">ID Card</option>
                <option value="Wallet">Wallet</option>
                <option value="Keys">Keys</option>
                <option value="Books">Books</option>
                <option value="Clothing">Clothing</option>
                <option value="Bags">Bags</option>
                <option value="Accessories">Accessories</option>
                <option value="Other">Other</option>
              </select>

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                type="text"
                required
                minLength={2}
                maxLength={200}
                placeholder="e.g. Library, Block A"
                value={formData.location}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    location: event.target.value,
                  })
                }
              />

              <label htmlFor="date">Date lost or found</label>
              <input
                id="date"
                name="date"
                type="date"
                required
                max={getTodayDate()}
                value={formData.date}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    date: event.target.value,
                  })
                }
              />

              <label htmlFor="item-image">
                Item photo (optional)
              </label>
              <input
                id="item-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setFormError("");

                  if (!file) {
                    setImageFile(null);
                    return;
                  }

                  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                  if (!allowedTypes.includes(file.type)) {
                    setFormError("Please select a JPEG, PNG, or WebP image.");
                    event.target.value = "";
                    setImageFile(null);
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setFormError("Image must be 5 MB or smaller.");
                    event.target.value = "";
                    setImageFile(null);
                    return;
                  }

                  setImageFile(file);
                }}
              />
              <small>JPEG, PNG, or WebP. Maximum size: 5 MB.</small>

              {imagePreview && (
                <div style={{ marginTop: "12px" }}>
                  <img
                    src={imagePreview}
                    alt="Preview of selected item"
                    style={{
                      display: "block",
                      width: "100%",
                      maxWidth: "280px",
                      maxHeight: "220px",
                      objectFit: "contain",
                      borderRadius: "12px",
                      border: "1px solid #d1d5db",
                    }}
                  />
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setImageFile(null)}
                  >
                    Remove photo
                  </button>
                </div>
              )}

              <div className="report-status">
                <span>Report type</span>
                <strong>
                  {reportStatus === "lost" ? "Lost Item" : "Found Item"}
                </strong>
              </div>

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="report-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => {
                    setShowReportForm(false);
                    setFormError("");
                    setImageFile(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="success-message" role="status">
          <span>{successMessage}</span>

          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      {/* My Reports dashboard */}
      {showMyReports && currentUser && (
        <section className="items-section my-reports-section" id="my-reports">
          <div className="my-reports-heading">
            <span className="eyebrow">YOUR CAMPUSRECOVER ACTIVITY</span>
            <h2>My Reports</h2>
            <p>Track the lost and found items you have reported.</p>
            <div className="report-actions my-reports-toolbar">
              <button
                type="button"
                className="secondary-button"
                onClick={fetchMyReports}
                disabled={myReportsLoading}
              >
                {myReportsLoading ? "Refreshing..." : "Refresh reports"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setShowMyReports(false);
                  document.getElementById("items")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Browse all items
              </button>
            </div>
          </div>

          <div className="my-reports-stats">
            <div className="my-reports-stat">
              <span>Total reports</span>
              <strong>{myReports.length}</strong>
            </div>
            <div className="my-reports-stat">
              <span>Lost</span>
              <strong>{myReports.filter((item) => item.status === "lost").length}</strong>
            </div>
            <div className="my-reports-stat">
              <span>Found</span>
              <strong>{myReports.filter((item) => item.status === "found").length}</strong>
            </div>
            <div className="my-reports-stat">
              <span>Claimed</span>
              <strong>{myReports.filter((item) => item.status === "claimed").length}</strong>
            </div>
          </div>

          {myReportsError && (
            <p className="form-error" role="alert">{myReportsError}</p>
          )}

          {myReportsLoading ? (
            <div className="empty-state">
              <h3>Loading your reports...</h3>
              <p>Getting your latest CampusRecover activity.</p>
            </div>
          ) : myReports.length === 0 && !myReportsError ? (
            <div className="empty-state">
              <h3>You haven't reported any items yet</h3>
              <p>Your lost and found reports will appear here after you submit them.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => openReportForm("lost")}
              >
                Report an item
              </button>
            </div>
          ) : (
            <div className="items-grid my-reports-grid">
              {myReports.map((item) => (
                <article className="item-card my-report-card" key={item._id}>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="item-image"
                      loading="lazy"
                    />
                  )}
                  <span className={`status status-${item.status}`}>{item.status}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>Location:</strong> {item.location}</p>
                  <p><strong>Date:</strong> {new Date(item.date).toLocaleDateString()}</p>
                  <div className="report-actions my-report-actions">
                    {item.status !== "claimed" && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={updatingStatus}
                        onClick={() => handleMarkClaimed(item)}
                      >
                        {updatingStatus ? "Updating..." : "Mark claimed"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={deletingReportId === item._id}
                      onClick={() => handleDeleteReport(item)}
                    >
                      {deletingReportId === item._id ? "Deleting..." : "Delete report"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Item details view */}
      {selectedItem && (
        <section className="details-section">
          <div className="details-container">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSelectedItem(null);
                setActionError("");
              }}
            >
              ← Back to Items
            </button>

            <div className="details-card">
              {selectedItem.imageUrl && (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.title}
                  className="details-image"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}

              <div className="details-content">
                <span
                  className={`status status-${selectedItem.status}`}
                >
                  {selectedItem.status}
                </span>

                <h2>{selectedItem.title}</h2>

                <p className="details-description">
                  {selectedItem.description}
                </p>

                <div className="details-field">
                  <strong>Category</strong>
                  <span>{selectedItem.category}</span>
                </div>

                <div className="details-field">
                  <strong>Location</strong>
                  <span>{selectedItem.location}</span>
                </div>

                <div className="details-field">
                  <strong>Date</strong>
                  <span>
                    {new Date(
                      selectedItem.date
                    ).toLocaleDateString()}
                  </span>
                </div>

                {actionError && (
                  <p className="form-error" role="alert">
                    {actionError}
                  </p>
                )}

                {selectedItem.status !== "claimed" &&
                  currentUser &&
                  selectedItem.createdBy === currentUser.id && (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={updatingStatus}
                    onClick={() => handleMarkClaimed(selectedItem)}
                  >
                    {updatingStatus
                      ? "Updating..."
                      : "Mark as Claimed"}
                  </button>
                )}

                {selectedItem.status === "claimed" && (
                  <p>
                    This item has been marked as claimed.
                  </p>
                )}

                {selectedItem.status !== "claimed" &&
                  (!currentUser ||
                    selectedItem.createdBy !== currentUser.id) && (
                    <p>
                      Only the user who reported this item can update its status.
                    </p>
                  )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSelectedItem(null);
                    setActionError("");
                  }}
                >
                  Browse Other Items
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Items list, filters and sorting */}
      <section className="items-section" id="items">
        <div>
          <span className="eyebrow">CAMPUS LOST & FOUND</span>

          <h2>Find what you're looking for</h2>

          <p>Recent reports from your campus community.</p>

          {/* Filters */}
          <div className="filters-bar">
            <div className="filter-control">
              <label htmlFor="status-filter">Status</label>

              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
                <option value="claimed">Claimed</option>
              </select>
            </div>

            <div className="filter-control">
              <label htmlFor="category-filter">Category</label>

              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="all">All categories</option>

                {[...new Set(items.map((item) => item.category))]
                  .sort()
                  .map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
              </select>
            </div>

            <div className="filter-control">
              <label htmlFor="sort-order">Sort by</label>

              <select
                id="sort-order"
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value)
                }
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setCategoryFilter("all");
                setSortOrder("newest");
              }}
            >
              Reset filters
            </button>
          </div>

          <p className="results-count">
            Showing {filteredItems.length} of {items.length} items
          </p>
        </div>

        {loading ? (
          <div className="empty-state">
            <h3>Loading items...</h3>
            <p>Connecting to CampusRecover.</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Unable to load items</h3>
            <p>{error}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ◎
            </div>

            <h3>
              {search ||
              statusFilter !== "all" ||
              categoryFilter !== "all"
                ? "No matching items found"
                : "No items reported yet"}
            </h3>

            <p>
              {search ||
              statusFilter !== "all" ||
              categoryFilter !== "all"
                ? "Try changing your search or filters."
                : "When students report lost or found items, they will appear here."}
            </p>
          </div>
        ) : (
          <div className="items-grid">
            {filteredItems.map((item) => (
              <article
                className="item-card"
                key={item._id}
                onClick={() => {
                  setSelectedItem(item);
                  setActionError("");
                  setShowReportForm(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    setSelectedItem(item);
                    setActionError("");
                    setShowReportForm(false);
                  }
                }}
                aria-label={`View details for ${item.title}`}
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="item-image"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}

                <span
                  className={`status status-${item.status}`}
                >
                  {item.status}
                </span>

                <h3>{item.title}</h3>

                <p>{item.description}</p>

                <p>
                  <strong>Category:</strong> {item.category}
                </p>

                <p>
                  <strong>Location:</strong> {item.location}
                </p>

                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(item.date).toLocaleDateString()}
                </p>

                <span className="card-view-link">
                  View details →
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="how-section" id="how-it-works">
        <h2>How CampusRecover works</h2>

        <div className="steps-grid">
          <article className="step-card">
            <span>01</span>
            <h3>Report an item</h3>
            <p>Share details about something you lost or found.</p>
          </article>

          <article className="step-card">
            <span>02</span>
            <h3>Browse reports</h3>
            <p>Search reports to find a possible match.</p>
          </article>

          <article className="step-card">
            <span>03</span>
            <h3>Reconnect</h3>
            <p>Help belongings return to their owners.</p>
          </article>
        </div>
      </section>

      <footer className="footer">
        CampusRecover · Making campus life a little easier.
      </footer>
    </main>
  );
}

export default App;
