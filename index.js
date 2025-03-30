module.exports.handler = async (event) => {
    const response = {
      statusCode: 200,
      body: JSON.stringify('Hello from Lambda writed by Dev!'),
    };
    return response;
  };