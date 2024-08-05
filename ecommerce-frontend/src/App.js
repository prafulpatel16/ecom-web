import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';



function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState(null); // Track error state

  useEffect(() => {
    // Fetch products from backend API
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/products`)
      .then(response => {
        setProducts(response.data);
        setLoading(false); // Set loading to false after successful fetch
      })
      .catch(error => {
        console.error('Error fetching products:', error);
        setError('Error fetching products. Please try again later.');
        setLoading(false); // Set loading to false even if there's an error
      });
  }, []);

  if (loading) {
    return <div className="App">Loading...</div>; // Display loading message
  }

  if (error) {
    return <div className="App">{error}</div>; // Display error message
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Product List</h1>
        <ul>
          {products.length > 0 ? (
            products.map(product => (
              <li key={product.id}>{product.name} - ${product.price}</li>
            ))
          ) : (
            <li>No products available</li> // Message when no products are found
          )}
        </ul>
      </header>
    </div>
  );
}

export default App;
