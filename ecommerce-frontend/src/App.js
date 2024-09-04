import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import axiosInstance from './axiosInstance'; // Import the Axios instance


function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const backendUrl = `${process.env.REACT_APP_BACKEND_SERVICE}/api/products?timestamp=${Date.now()}`;
        console.log('Backend URL:', backendUrl);

        const response = await axios.get(backendUrl);
        console.log('Products response:', response);
        setProducts(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
        setError(`Error fetching products: ${error.message}. Please try again later.`);
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleSendMessage = async () => {
    const backendUrl = `${process.env.REACT_APP_BACKEND_SERVICE}/api/product_queue`; // Relative path to your backend endpoint

    try {
      const response = await axiosInstance.post(backendUrl, {
        product: {
          name: productName,
          price: parseFloat(productPrice),
        },
      });

      setResponseMessage(response.data.message);
    } catch (error) {
      console.error('Error sending product to queue:', error);
      setResponseMessage(error.response ? error.response.data : error.message);
    }
  };
  if (loading) {
    return <div className="App">Loading...</div>;
  }

  if (error) {
    return <div className="App">{error}</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Product List</h1>
        <ul>
          {products.length > 0 ? (
            products.map((product) => (
              <li key={product.id}>{product.name} - ${product.price}</li>
            ))
          ) : (
            <li>No products available</li>
          )}
        </ul>
        <div>
          <h2>RabbitMQ Product Test</h2>
          <input
            type="text"
            placeholder="Product Name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Product Price"
            value={productPrice}
            onChange={(e) => setProductPrice(e.target.value)}
          />
          <button onClick={handleSendMessage}>Send to Queue</button>
          <p>{responseMessage}</p>
        </div>
      </header>
    </div>
  );
}

export default App;
