import {input, select} from "@inquirer/prompts";
import chalk from "chalk";

import {clm} from "../clm.js";
import {configStore} from "../config-store.js";

export const checkNetwork = {

    async configureIpAddress() {
        const {CL_EXTERNAL_IP: currentIpAddress} = configStore.getEnvCommonInfo();
        const detectedIpAddress = await checkNetwork.fetchIPAddress().catch(() => '');

        if (!currentIpAddress && !detectedIpAddress) {
            const newIpAddress = await checkNetwork.enterIpAddressManually();
            configStore.setEnvCommonInfo({CL_EXTERNAL_IP: newIpAddress});
            return;
        }

        if (currentIpAddress) {
            clm.postStep("\nIP address is currently set to: " + chalk.cyan(currentIpAddress));
        }

        if(detectedIpAddress) {
            clm.postStep("\nDetected IP address: " + chalk.cyan(detectedIpAddress) + "\n");
        }

        const choices = [{
            disabled: !currentIpAddress,
            name: 'Keep current IP address',
            value: 'current'
        }, {
            disabled: !detectedIpAddress,
            name: 'Use detected IP address',
            value: 'detected'
        }, {
            name: 'Enter IP address manually:',
            value: 'manual'
        }];

        const answer = await select({ choices, message: '' });

        let selectedIpAddress = currentIpAddress;

        if (answer === 'detected') {
            selectedIpAddress = detectedIpAddress;
        }
        else if (answer === 'manual') {
            selectedIpAddress = await checkNetwork.enterIpAddressManually();
        }

        configStore.setEnvCommonInfo({CL_EXTERNAL_IP: selectedIpAddress});
    },

    async detectExternalIpAddress () {

        const externalIp = await this.fetchIPAddress()
            .catch(error => {
                clm.warn(`Error while detecting your IP address: ${error.message}`);
                return this.enterIpAddressManually();
            })

        clm.postStep("\nExternal IP address: " + chalk.cyan(externalIp) + "\n");

        configStore.setEnvCommonInfo({CL_EXTERNAL_IP: externalIp});
    },

    async enterIpAddressManually() {
        return input({
            message: 'Please enter the IP address manually:',
            validate(value: string) {
                // Basic validation for IP address format
                const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                if (ipRegex.test(value.trim())) {
                    return true;
                }

                return 'Please enter a valid IP address (e.g., 192.168.1.1)';
            }
        });
    },

    async fetchIPAddress() {
        return fetch('https://ifconfig.me/ip')
            .then(res => {
                if(res.ok) return res.text();
                throw new Error('Failed to fetch IP address');
            })
    }
}