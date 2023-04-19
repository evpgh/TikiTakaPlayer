// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TikiTakaPlayers is ERC721 {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _tokenIdCounter;

    struct Player {
        uint256 tokenId;
        string name;
        string nationality;
        string avatarCID; // IPFS CID of the avatar
        address teamOwner;
    }

    struct Auction {
        uint256 tokenId;
        uint256 endTime;
        uint256 startPrice;
        uint256 currentBid;
        address currentBidder;
    }

    mapping(uint256 => Player) public players;
    mapping(uint256 => Auction) public auctions;

    event PlayerMinted(uint256 tokenId, address teamOwner);
    event AuctionStarted(uint256 tokenId, uint256 endTime, uint256 startPrice);
    event BidPlaced(uint256 tokenId, uint256 amount, address bidder);
    event AuctionEnded(uint256 tokenId, address winner, uint256 finalBid);

    constructor() ERC721("TikiTakaPlayers", "TTKP") {}

    function mintPlayer(
        address teamOwner,
        string memory name,
        string memory nationality,
        string memory avatarCID // IPFS CID of the avatar
    ) public {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        _safeMint(teamOwner, newTokenId);
        players[newTokenId] = Player(newTokenId, name, nationality, avatarCID, teamOwner);
        emit PlayerMinted(newTokenId, teamOwner);
    }

    function startAuction(uint256 tokenId, uint256 startPrice) public {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        uint256 endTime = block.timestamp.add(86400); // 1 day = 86400 seconds
        auctions[tokenId] = Auction(tokenId, endTime, startPrice, 0, address(0));
        emit AuctionStarted(tokenId, endTime, startPrice);
    }

    function placeBid(uint256 tokenId, uint256 amount) public payable {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp < auction.endTime, "Auction ended");
        require(amount >= auction.startPrice, "Bid below start price");
        require(amount > auction.currentBid, "Bid below current highest bid");

        if (auction.currentBidder != address(0)) {
            // Refund the previous highest bidder
            payable(auction.currentBidder).transfer(auction.currentBid);
        }

        auction.currentBid = amount;
        auction.currentBidder = msg.sender;
        emit BidPlaced(tokenId, amount, msg.sender);
    }

    function finalizeAuction(uint256 tokenId) public {
        Auction storage auction = auctions[tokenId];
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.currentBidder == msg.sender, "Not the highest bidder");

        address winner = auction.currentBidder;
        uint256 finalBid = auction.currentBid;

        // Transfer NFT ownership to the highest bidder
        _safeTransfer(ownerOf(tokenId), winner, tokenId, "");

        // Send the auction amount to the previous owner
        payable(ownerOf(tokenId)).transfer(finalBid);

        // Remove the auction
        delete auctions[tokenId];

        emit AuctionEnded(tokenId, winner, finalBid);
    }
}