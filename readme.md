# DynDNS Updater

This script provides an automatic method of updating CloudFlare DNS entries via a GET request using the Source IP of the request.
This implementation permits the IP of the source request to be used when the device sending the request does not know the external IP, for example, updating the Public IP of a Cisco router automatically using EEM

### Security Note

If the endpoint is unauthenticated, the Lambda enviroment variable 'DOMAIN' should be set to a subdomain, otherwise any A record can be overwritten by an unauthenticated attacker in the destined zone.
For example, if `rootdomain.zyx` is used, an attacker can update `mail.rootdomain.zyx` to be their own IP and capture traffic. If `dynamic.rootdomain.zyx` is populated, the attacker would mearly update `mail.dynamic.rootdomain.zyx`.

In addition, the A record must already exist in CloudFlare, this implementation will not auto-create a A record, and will return a 404 if the requested A record does not exist.

### Cisco EEM Script

Here is an example EEM script which updates the hostname A record

*Note, when pasting the following applet, you will need to enter CTRL+V before adding the '?' or the CLI will interpret this as a request for help*

```
event manager applet DDNS_UPDATE
 event timer watchdog time 300
 action 1.0 cli command "enable"
 action 2.0 set URL "https://api.gateway.endpoint/stage/update_ddns\026?updateEntry="
 action 3.0 set HOSTNAME "unknown"
 action 4.0 cli command "show version | inc uptime is"
 action 5.0 regexp "([A-Za-z0-9-]+) uptime is" "$_cli_result" globalmatch HOSTNAME
 action 6.0 append URL "$HOSTNAME"
 action 7.0 cli command "copy $URL null:"
```

Note that for HTTPS support to work, the device will need a TrustPool, this can be configured with:

```
crypto pki trustpool policy
 cabundle url http://www.cisco.com/security/pki/trs/ios.p7b
 chain-validation
 revocation-check none
```