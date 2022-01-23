const AWS = require('aws-sdk');
const https = require('https');

/**
 * Perform an update of a CloudFlare DNS Entry based on the Source IP of the request
 */
 
// String Sanitizing Regex
const regex = "/([^a-zA-Z0-9\-]*)/g";
 
// Update the CloudFlare DNS Object
async function updateDNSEntry(entry, record)
{
    return await new Promise((resolve, reject) =>
    {
        // Find the record
        const existingRecord = entry + "." + process.env.DOMAIN.toString().trim();

        // Build Domain Request
        var requestOptions =
        {
            headers: { 'Authorization': "Bearer " + process.env.CLOUDFLARE_TOKEN, 'Content-Type': "application/json" },
            path: "/client/v4/zones/" + process.env.CLOUDFLARE_ZONE + "/dns_records?type=A&name=" + existingRecord,
            host: 'api.cloudflare.com',
            method: 'GET',
            port: 443,
        };
        
        // Make Domain Request
        https.get(requestOptions, (resp) =>
        {
            // Process data retrieval
            let data = '';
            resp.on('data', (chunk) =>
            {
                data += chunk;
            });
            
            // Handle the completion of all data
            resp.on('end', () =>
            {
                // Process JSON Data
                let jsonResponse = JSON.parse(data.toString().trim());
                if( jsonResponse != undefined && jsonResponse.result[0].id != undefined )
                {
                    // Retrieve the Entry ID from the JSON Response
                    let entryId = jsonResponse.result[0].id.toString().trim();
                    console.log("Retrieved entry id '" + entryId + "' for zone '" + existingRecord + "'");
                    
                    // Perform the Zone Update
                    var updateRequestOptions =
                    {
                        headers: { 'Authorization': "Bearer " + process.env.CLOUDFLARE_TOKEN, 'Content-Type': "application/json" },
                        path: "/client/v4/zones/" + process.env.CLOUDFLARE_ZONE + "/dns_records/" + entryId,
                        host: 'api.cloudflare.com',
                        method: 'PUT',
                        port: 443,
                    };
                    
                    // Make Domain Update Request
                    const postRequest = https.request(updateRequestOptions, (resp) =>
                    {
                        // Process data retrieval
                        let data2 = '';
                        resp.on('data', (chunk) =>
                        {
                            data2 += chunk;
                        });
                        
                        // Handle the completion of all data
                        resp.on('end', () =>
                        {
                            // Process JSON Data
                            let jsonResponse = JSON.parse(data2.toString().trim());
                            if( jsonResponse != undefined && jsonResponse.success )
                            {
                                // Entry update successful
                                resolve({
                                    body: 'Update successful',
                                    statusCode: 200
                                });
                            }
                            else
                            {
                                // Failed JSON Response
                                console.log(data2);
                                reject({
                                    body: 'HTTP 500 Internal Server Error',
                                    statusCode: 500
                                });
                            }
                        });
                    });
                    
                    // Handle Post Error
                    postRequest.on("error", (err) =>
                    {
                        console.log("Error: " + err.message);
                        reject({
                            body: 'HTTP 500 Internal Server Error',
                            statusCode: 500
                        });
                    });
                    
                    // Post Data
                    postRequest.write(JSON.stringify({
                        name: existingRecord,
                        content: record,
                        proxied: false,
                        type: "A",
                        ttl: 60
                    }));
                    
                    postRequest.end();
                }
                else
                {
                    // Failed JSON Response
                    console.log("Unable to retrieve the Entry ID from the CF Response");
                    reject({
                        body: 'HTTP 500 Internal Server Error',
                        statusCode: 500
                    });
                }
            });
        }).on("error", (err) =>
        {
            console.log("Error: " + err.message);
            reject({
                body: 'HTTP 500 Internal Server Error',
                statusCode: 500
            });
        });
    });
}
 
// API Gateway Handler
exports.handler = async (event, context) =>
{
    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'text/html',
    };
    
    // Log the received data (for debugging)
    //console.log('Received event:', JSON.stringify(event, null, 2));
    const sourceIP = event.requestContext.http.sourceIp;
    const queryParameters = event.queryStringParameters;
    
    // Check we have valid parameters
    if( queryParameters == undefined || queryParameters.length == 0 )
    {
        // Invalid Parameters
        console.log("Missing query parameters; Request rejected");
        body = "HTTP 400 Bad Request";
        statusCode = 400;
    }
    else
    {
        // Valid Parameters
        if( queryParameters["updateEntry"] != undefined && queryParameters["updateEntry"].length > 0 )
        {
            // Get the entry to update
            const updateEntry = (queryParameters["updateEntry"].toString().trim()).replace(regex, '');
            console.log("Client requesting update of entry: " + updateEntry);
            
            // Get the Source IP of the request
            if( sourceIP != undefined && sourceIP.length > 0 )
            {
                console.log("Request is from source IP: " + sourceIP);
                return updateDNSEntry(updateEntry, sourceIP);
            }
            else
            {
                // Invalid Source IP (This shouldn't happen unless API Gateway doesn't send the right data?)
                console.log("Request is from an invalid source IP");
                body = "HTTP 500 Internal Server Error";
                statusCode = 500; 
            }
        }
        else
        {
            // Invalid Entry
            console.log("Missing updateEntry parameter; Request rejected");
            body = "HTTP 400 Bad Request";
            statusCode = 400;
        }
    }

    // Return the status determined by the code flow to API Gateway
    return {
        statusCode,
        body,
        headers,
    };
};
